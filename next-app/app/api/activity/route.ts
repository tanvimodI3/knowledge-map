import { adminDb } from "@/lib/firebase-admin";
import { verifyRequest } from "@/lib/auth-helpers";
import { errorResponse } from "@/app/api/_lib/errors";

export async function GET(request: Request) {
  const decoded = await verifyRequest(request);
  if (!decoded) {
    return errorResponse(401, "UNAUTHENTICATED", "Invalid or missing token");
  }
  const uid = decoded.uid;

  try {
    // Parse optional limit query param (default and max = 20).
    const url = new URL(request.url);
    const rawLimit = parseInt(url.searchParams.get("limit") ?? "20", 10);
    const limit = Math.min(Number.isNaN(rawLimit) ? 20 : rawLimit, 20);

    const snap = await adminDb
      .collection(`users/${uid}/activity`)
      .orderBy("at", "desc")
      .limit(limit)
      .get();

    const activity = snap.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        mapId: d.mapId,
        message: d.message,
        at: d.at.toDate().toISOString(),
      };
    });

    return Response.json({ activity });
  } catch (err) {
    console.error("GET /api/activity error:", err);
    return errorResponse(500, "INTERNAL_ERROR", "Failed to fetch activity");
  }
}
