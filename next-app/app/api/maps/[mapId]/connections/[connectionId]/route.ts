import { adminDb } from "@/lib/firebase-admin";
import { verifyRequest } from "@/lib/auth-helpers";
import { Timestamp } from "firebase-admin/firestore";
import { errorResponse } from "@/app/api/_lib/errors";
import { logActivity } from "@/app/api/_lib/activity";
import { mapRef } from "@/app/api/_lib/firestore-helpers";

type Params = { params: Promise<{ mapId: string; connectionId: string }> };

export async function DELETE(request: Request, { params }: Params) {
  const decoded = await verifyRequest(request);
  if (!decoded) {
    return errorResponse(401, "UNAUTHENTICATED", "Invalid or missing token");
  }

  const uid = decoded.uid;
  const { mapId, connectionId } = await params;
  const mRef = mapRef(uid, mapId);

  try {
    // ── verify map exists and is not deleted ──
    const mapSnap = await mRef.get();
    if (!mapSnap.exists || mapSnap.data()?.deletedAt) {
      return errorResponse(404, "NOT_FOUND", "Map not found");
    }

    // ── verify connection exists ──
    const connRef = mRef.collection("connections").doc(connectionId);
    const connSnap = await connRef.get();
    if (!connSnap.exists) {
      return errorResponse(404, "NOT_FOUND", "Connection not found");
    }

    // ── delete + bump map ──
    const batch = adminDb.batch();
    batch.delete(connRef);
    batch.update(mRef, { updatedAt: Timestamp.now() });
    await batch.commit();

    await logActivity(uid, mapId, `Removed a connection`);

    return Response.json({ connectionId, deleted: true });
  } catch (err) {
    console.error(
      "DELETE /api/maps/[mapId]/connections/[connectionId] error:",
      err,
    );
    return errorResponse(
      500,
      "INTERNAL_ERROR",
      "Failed to delete connection",
    );
  }
}
