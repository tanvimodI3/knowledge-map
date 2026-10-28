import { createHash } from "node:crypto"
import { Timestamp } from "firebase-admin/firestore"

import { errorResponse } from "@/app/api/_lib/errors"
import { mapRef } from "@/app/api/_lib/firestore-helpers"
import {
  generateRankedPaths,
  type RankedPath,
  type RecommendationSummary,
} from "@/app/api/_lib/path-recommendations"
import { verifyRequest } from "@/lib/auth-helpers"
import { adminDb } from "@/lib/firebase-admin"
import { fetchMapAsGraph } from "@/lib/knowledge-map/graph-converter"
import { PathFinder } from "@/recommendation/path_finder.mjs"

export const runtime = "nodejs"

type Params = { params: Promise<{ mapId: string }> }
type StoredRecommendation = {
  mapId: string
  options: RankedPath[]
  selectedPathId: string | null
  summary: RecommendationSummary
  graphFingerprint: string
  generatedAt: Timestamp
  selectedAt: Timestamp
}

function fingerprintGraph(
  graphData: NonNullable<Awaited<ReturnType<typeof getActiveGraph>>>
) {
  const skills = Object.entries(graphData.entities)
    .filter(([id]) => id !== graphData.userId)
    .map(([id, entity]) => [id, entity.name])
    .sort(([left], [right]) => left.localeCompare(right))
  const connections = graphData.triples
    .filter((triple) => triple.relation !== "interacts")
    .map((triple) => [triple.head, triple.relation, triple.tail])
    .sort((left, right) =>
      JSON.stringify(left).localeCompare(JSON.stringify(right))
    )
  return createHash("sha256")
    .update(JSON.stringify({ skills, connections }))
    .digest("hex")
}

function responseShape(data: StoredRecommendation) {
  const selectedPath =
    data.options.find((option) => option.id === data.selectedPathId) ?? null
  return {
    mapId: data.mapId,
    options: data.options,
    selectedPathId: data.selectedPathId,
    selectedPath,
    summary: data.summary,
    generatedAt: data.generatedAt.toDate().toISOString(),
    selectedAt: data.selectedAt.toDate().toISOString(),
  }
}

async function getActiveGraph(uid: string, mapId: string) {
  return fetchMapAsGraph(uid, mapId)
}

export async function GET(request: Request, { params }: Params) {
  const decoded = await verifyRequest(request)
  if (!decoded) {
    return errorResponse(401, "UNAUTHENTICATED", "Invalid or missing token")
  }

  const { mapId } = await params
  try {
    const graphData = await getActiveGraph(decoded.uid, mapId)
    if (!graphData) {
      return errorResponse(404, "NOT_FOUND", "Map not found")
    }

    const recommendationRef = mapRef(decoded.uid, mapId)
      .collection("pathRecommendations")
      .doc("current")
    const snapshot = await recommendationRef.get()
    if (!snapshot.exists) {
      return errorResponse(
        404,
        "NOT_FOUND",
        "No path recommendations have been generated"
      )
    }

    const recommendation = snapshot.data() as StoredRecommendation
    if (recommendation.graphFingerprint !== fingerprintGraph(graphData)) {
      return errorResponse(
        404,
        "NOT_FOUND",
        "Path recommendations are outdated; generate them again"
      )
    }

    return Response.json({ recommendation: responseShape(recommendation) })
  } catch (error) {
    console.error("GET /api/maps/[mapId]/path-recommendations error:", error)
    return errorResponse(
      500,
      "INTERNAL_ERROR",
      "Failed to read path recommendations"
    )
  }
}

export async function POST(request: Request, { params }: Params) {
  const decoded = await verifyRequest(request)
  if (!decoded) {
    return errorResponse(401, "UNAUTHENTICATED", "Invalid or missing token")
  }

  const { mapId } = await params
  const url = new URL(request.url)
  const maxDepth = Number(url.searchParams.get("maxDepth") ?? 3)
  const maxPaths = Number(url.searchParams.get("maxPaths") ?? 200)
  if (
    !Number.isInteger(maxDepth) ||
    maxDepth < 1 ||
    maxDepth > 6 ||
    !Number.isInteger(maxPaths) ||
    maxPaths < 1 ||
    maxPaths > 1000
  ) {
    return errorResponse(
      400,
      "INVALID_INPUT",
      "maxDepth or maxPaths is out of range"
    )
  }

  try {
    const graphData = await getActiveGraph(decoded.uid, mapId)
    if (!graphData) {
      return errorResponse(404, "NOT_FOUND", "Map not found")
    }

    const finder = new PathFinder(
      { entities: graphData.entities, triples: graphData.triples },
      maxDepth,
      maxPaths
    )
    const { allPaths, testPairs } = finder.runDiscovery(0)
    const result = await generateRankedPaths({
      paths: allPaths,
      testPairs,
      graph: {
        entities: graphData.entities,
        triples: graphData.triples,
      },
    })

    const now = Timestamp.now()
    const recommendation: StoredRecommendation = {
      mapId,
      options: result.options,
      selectedPathId: result.options[0]?.id ?? null,
      summary: result.summary,
      graphFingerprint: fingerprintGraph(graphData),
      generatedAt: now,
      selectedAt: now,
    }
    const recommendationRef = mapRef(decoded.uid, mapId)
      .collection("pathRecommendations")
      .doc("current")
    await recommendationRef.set(recommendation)

    return Response.json(
      { recommendation: responseShape(recommendation) },
      { status: 201 }
    )
  } catch (error) {
    console.error("POST /api/maps/[mapId]/path-recommendations error:", error)
    return errorResponse(
      500,
      "INTERNAL_ERROR",
      "Failed to generate and store path recommendations"
    )
  }
}

export async function PATCH(request: Request, { params }: Params) {
  const decoded = await verifyRequest(request)
  if (!decoded) {
    return errorResponse(401, "UNAUTHENTICATED", "Invalid or missing token")
  }

  const { mapId } = await params
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorResponse(
      400,
      "INVALID_INPUT",
      "Request body must be valid JSON"
    )
  }
  if (
    !body ||
    typeof body !== "object" ||
    !("pathId" in body) ||
    typeof body.pathId !== "string" ||
    !body.pathId.trim()
  ) {
    return errorResponse(400, "INVALID_INPUT", "A pathId is required")
  }
  const pathId = body.pathId

  try {
    const graphData = await getActiveGraph(decoded.uid, mapId)
    if (!graphData) {
      return errorResponse(404, "NOT_FOUND", "Map not found")
    }

    const recommendationRef = mapRef(decoded.uid, mapId)
      .collection("pathRecommendations")
      .doc("current")
    let updatedRecommendation: StoredRecommendation | null = null
    await adminDb.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(recommendationRef)
      if (!snapshot.exists) {
        return
      }

      const data = snapshot.data() as StoredRecommendation
      if (data.graphFingerprint !== fingerprintGraph(graphData)) {
        return
      }
      if (!data.options.some((option) => option.id === pathId)) {
        return
      }

      const selectedAt = Timestamp.now()
      transaction.update(recommendationRef, {
        selectedPathId: pathId,
        selectedAt,
      })
      updatedRecommendation = { ...data, selectedPathId: pathId, selectedAt }
    })

    if (!updatedRecommendation) {
      return errorResponse(404, "NOT_FOUND", "Path option not found")
    }

    return Response.json({
      recommendation: responseShape(updatedRecommendation),
    })
  } catch (error) {
    console.error("PATCH /api/maps/[mapId]/path-recommendations error:", error)
    return errorResponse(500, "INTERNAL_ERROR", "Failed to select path option")
  }
}
