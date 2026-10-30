import { adminDb } from "@/lib/firebase-admin";
import { verifyRequest } from "@/lib/auth-helpers";
import { Timestamp } from "firebase-admin/firestore";
import { errorResponse } from "@/app/api/_lib/errors";
import {
  isNonEmptyString,
  isValidConnectionType,
} from "@/app/api/_lib/validate";
import { logActivity } from "@/app/api/_lib/activity";
import { mapRef } from "@/app/api/_lib/firestore-helpers";

type Params = { params: Promise<{ mapId: string }> };

export async function POST(request: Request, { params }: Params) {
  const decoded = await verifyRequest(request);
  if (!decoded) {
    return errorResponse(401, "UNAUTHENTICATED", "Invalid or missing token");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "INVALID_INPUT", "Request body must be JSON");
  }

  const { sourceId, targetId, type } = body as Record<string, unknown>;

  // ── validate fields ──
  if (!isNonEmptyString(sourceId)) {
    return errorResponse(400, "INVALID_INPUT", "sourceId is required");
  }
  if (!isNonEmptyString(targetId)) {
    return errorResponse(400, "INVALID_INPUT", "targetId is required");
  }
  if (!isValidConnectionType(type)) {
    return errorResponse(
      400,
      "INVALID_INPUT",
      "Type must be prerequisite or related",
    );
  }
  if (sourceId === targetId) {
    return errorResponse(
      400,
      "INVALID_INPUT",
      "Cannot connect a skill to itself",
    );
  }

  const uid = decoded.uid;
  const { mapId } = await params;
  const mRef = mapRef(uid, mapId);

  try {
    // ── verify map exists and is not deleted ──
    const mapSnap = await mRef.get();
    if (!mapSnap.exists || mapSnap.data()?.deletedAt) {
      return errorResponse(404, "NOT_FOUND", "Map not found");
    }

    // ── verify both skills exist in this map ──
    const skillsCol = mRef.collection("skills");
    const [srcSnap, tgtSnap] = await Promise.all([
      skillsCol.doc(sourceId as string).get(),
      skillsCol.doc(targetId as string).get(),
    ]);
    if (!srcSnap.exists) {
      return errorResponse(400, "INVALID_INPUT", "Source skill not found");
    }
    if (!tgtSnap.exists) {
      return errorResponse(400, "INVALID_INPUT", "Target skill not found");
    }

    // ── duplicate check ──
    const existingConns = await mRef.collection("connections").get();
    const isDuplicate = existingConns.docs.some((doc) => {
      const d = doc.data();
      if (type === "prerequisite") {
        // Directed: exact sourceId→targetId match.
        return (
          d.type === "prerequisite" &&
          d.sourceId === sourceId &&
          d.targetId === targetId
        );
      }
      // "related" is undirected: (A,B) and (B,A) are duplicates.
      return (
        d.type === "related" &&
        ((d.sourceId === sourceId && d.targetId === targetId) ||
          (d.sourceId === targetId && d.targetId === sourceId))
      );
    });

    if (isDuplicate) {
      return errorResponse(
        409,
        "DUPLICATE_CONNECTION",
        "These skills are already connected",
      );
    }

    // ── create connection ──
    const now = Timestamp.now();
    const connRef = mRef.collection("connections").doc();

    const batch = adminDb.batch();
    batch.set(connRef, {
      sourceId,
      targetId,
      type,
      createdAt: now,
    });
    batch.update(mRef, { updatedAt: now });
    await batch.commit();

    // ── activity ──
    const srcName = srcSnap.data()?.name ?? "skill";
    const tgtName = tgtSnap.data()?.name ?? "skill";
    await logActivity(uid, mapId, `Connected ${srcName} and ${tgtName}`);

    return Response.json(
      {
        connection: {
          id: connRef.id,
          sourceId,
          targetId,
          type,
        },
      },
      { status: 201 },
    );
  } catch (err) {
    console.error("POST /api/maps/[mapId]/connections error:", err);
    return errorResponse(500, "INTERNAL_ERROR", "Failed to create connection");
  }
}
