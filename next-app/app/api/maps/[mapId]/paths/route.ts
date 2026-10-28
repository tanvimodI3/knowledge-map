import { verifyRequest } from "@/lib/auth-helpers";
import { errorResponse } from "@/app/api/_lib/errors";
import { fetchMapAsGraph } from "@/lib/knowledge-map/graph-converter";
import { PathFinder } from "@/recommendation/path_finder.mjs";

type Params = { params: Promise<{ mapId: string }> };

/**
 * GET /api/maps/[mapId]/paths
 *
 * Runs Part 1A Path Discovery (BFS) on the live Firestore data for this map.
 * Returns raw_paths suitable for feeding directly into Part 1B rule filtering.
 */
export async function GET(request: Request, { params }: Params) {
  const decoded = await verifyRequest(request);
  if (!decoded) {
    return errorResponse(401, "UNAUTHENTICATED", "Invalid or missing token");
  }

  const { mapId } = await params;
  const uid = decoded.uid;

  try {
    // 1. Fetch live map and transform to Knowledge Graph { entities, triples }
    const graphData = await fetchMapAsGraph(uid, mapId);
    if (!graphData) {
      return errorResponse(404, "NOT_FOUND", "Map not found");
    }

    const { entities, triples, userId } = graphData;

    // 2. Parse query parameters (maxDepth, maxPathsPerPair, holdout)
    const url = new URL(request.url);
    const maxDepth = parseInt(url.searchParams.get("maxDepth") || "3", 10);
    const maxPathsPerPair = parseInt(
      url.searchParams.get("maxPaths") || "200",
      10
    );
    const holdoutRatio = parseFloat(url.searchParams.get("holdout") || "0.0");

    // 3. Run Part 1A BFS Path Discovery
    const finder = new PathFinder({ entities, triples }, maxDepth, maxPathsPerPair);
    const { allPaths, testPairs, ruleFrequency } = finder.runDiscovery(holdoutRatio);

    return Response.json({
      mapId,
      userId,
      stats: {
        entityCount: Object.keys(entities).length,
        tripleCount: triples.length,
        discoveredPathCount: allPaths.length,
        testPairCount: testPairs.length,
      },
      ruleFrequency: Object.fromEntries(ruleFrequency),
      paths: allPaths,
      testPairs,
    });
  } catch (err) {
    console.error("GET /api/maps/[mapId]/paths error:", err);
    return errorResponse(
      500,
      "INTERNAL_ERROR",
      "Failed to discover paths for map"
    );
  }
}
