import { adminDb } from "@/lib/firebase-admin";
import { verifyRequest } from "@/lib/auth-helpers";
import { Timestamp } from "firebase-admin/firestore";
import { errorResponse } from "@/app/api/_lib/errors";
import { logActivity } from "@/app/api/_lib/activity";
import { mapRef } from "@/app/api/_lib/firestore-helpers";

type Params = { params: Promise<{ mapId: string; skillId: string }> };

export async function DELETE(request: Request, { params }: Params) {
  const decoded = await verifyRequest(request);
  if (!decoded) {
    return errorResponse(401, "UNAUTHENTICATED", "Invalid or missing token");
  }

  const uid = decoded.uid;
  const { mapId, skillId } = await params;
  const mRef = mapRef(uid, mapId);

  try {
    // ── verify map exists and is not deleted ──
    const mapSnap = await mRef.get();
    if (!mapSnap.exists || mapSnap.data()?.deletedAt !== null) {
      return errorResponse(404, "NOT_FOUND", "Map not found");
    }

    // ── verify skill exists ──
    const skillRef = mRef.collection("skills").doc(skillId);
    const skillSnap = await skillRef.get();
    if (!skillSnap.exists) {
      return errorResponse(404, "NOT_FOUND", "Skill not found");
    }
    const skillName = skillSnap.data()?.name ?? "skill";

    // ── find all connections that reference this skill ──
    const connsSnap = await mRef.collection("connections").get();
    const relatedConns = connsSnap.docs.filter((doc) => {
      const d = doc.data();
      return d.sourceId === skillId || d.targetId === skillId;
    });

    // ── batch delete: skill + related connections + bump map ──
    const batch = adminDb.batch();
    batch.delete(skillRef);
    relatedConns.forEach((doc) => batch.delete(doc.ref));
    batch.update(mRef, { updatedAt: Timestamp.now() });
    await batch.commit();

    await logActivity(uid, mapId, `Removed ${skillName}`);

    return Response.json({ skillId, deleted: true });
  } catch (err) {
    console.error("DELETE /api/maps/[mapId]/skills/[skillId] error:", err);
    return errorResponse(500, "INTERNAL_ERROR", "Failed to delete skill");
  }
}
