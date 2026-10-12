import { adminDb } from "@/lib/firebase-admin";
import { verifyRequest } from "@/lib/auth-helpers";
import { Timestamp } from "firebase-admin/firestore";
import { errorResponse } from "@/app/api/_lib/errors";
import { logActivity } from "@/app/api/_lib/activity";
import { assembleMap, mapRef } from "@/app/api/_lib/firestore-helpers";

type Params = { params: Promise<{ mapId: string }> };

/* ───────────────────── GET /api/maps/{mapId} ───────────────────── */

export async function GET(request: Request, { params }: Params) {
  const decoded = await verifyRequest(request);
  if (!decoded) {
    return errorResponse(401, "UNAUTHENTICATED", "Invalid or missing token");
  }

  const { mapId } = await params;
  const ref = mapRef(decoded.uid, mapId);

  try {
    const map = await assembleMap(ref);
    if (!map) {
      return errorResponse(404, "NOT_FOUND", "Map not found");
    }
    return Response.json({ map });
  } catch (err) {
    console.error("GET /api/maps/[mapId] error:", err);
    return errorResponse(500, "INTERNAL_ERROR", "Failed to fetch map");
  }
}

/* ──────────────────── DELETE /api/maps/{mapId} ─────────────────── */

export async function DELETE(request: Request, { params }: Params) {
  const decoded = await verifyRequest(request);
  if (!decoded) {
    return errorResponse(401, "UNAUTHENTICATED", "Invalid or missing token");
  }

  const uid = decoded.uid;
  const { mapId } = await params;
  const ref = mapRef(uid, mapId);

  try {
    const snap = await ref.get();
    if (!snap.exists) {
      return errorResponse(404, "NOT_FOUND", "Map not found");
    }

    const now = Timestamp.now();
    await ref.update({ deletedAt: now, updatedAt: now });

    const title = snap.data()?.title ?? "Untitled";
    await logActivity(uid, mapId, `Deleted ${title}`);

    return Response.json({ mapId, deleted: true });
  } catch (err) {
    console.error("DELETE /api/maps/[mapId] error:", err);
    return errorResponse(500, "INTERNAL_ERROR", "Failed to delete map");
  }
}

/* ──────────────────── PATCH /api/maps/{mapId} ──────────────────── */

export async function PATCH(request: Request, { params }: Params) {
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

  const { deleted } = body as Record<string, unknown>;
  if (deleted !== false) {
    return errorResponse(
      400,
      "INVALID_INPUT",
      'Only { "deleted": false } is accepted',
    );
  }

  const uid = decoded.uid;
  const { mapId } = await params;
  const ref = mapRef(uid, mapId);

  try {
    const snap = await ref.get();
    if (!snap.exists) {
      return errorResponse(404, "NOT_FOUND", "Map not found");
    }

    // Clear soft-delete.
    await ref.update({ deletedAt: null, updatedAt: Timestamp.now() });

    // Re-read assembled map after the update.
    const map = await assembleMap(ref);
    if (!map) {
      return errorResponse(500, "INTERNAL_ERROR", "Failed to restore map");
    }

    const title = snap.data()?.title ?? "Untitled";
    await logActivity(uid, mapId, `Restored ${title}`);

    return Response.json({ map });
  } catch (err) {
    console.error("PATCH /api/maps/[mapId] error:", err);
    return errorResponse(500, "INTERNAL_ERROR", "Failed to restore map");
  }
}
