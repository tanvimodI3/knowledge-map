import { adminDb } from "@/lib/firebase-admin";
import { verifyRequest } from "@/lib/auth-helpers";
import { Timestamp } from "firebase-admin/firestore";
import { errorResponse } from "@/app/api/_lib/errors";
import { isNonEmptyString } from "@/app/api/_lib/validate";
import { logActivity } from "@/app/api/_lib/activity";
import { assembleMap } from "@/app/api/_lib/firestore-helpers";

//gets-

export async function GET(request: Request) {
    const decoded = await verifyRequest(request);
    if (!decoded) {
        return errorResponse(401, "UNAUTHENTICATED", "Invalid or missing token");
    }
    const uid = decoded.uid;
    try {
        // Fetch all non-deleted maps for this user.
        const mapsSnap = await adminDb
            .collection(`users/${uid}/maps`)
            .where("deletedAt", "==", null)
            .orderBy("updatedAt", "desc")
            .get();
        // Assemble each map with its skills and connections.
        const maps = await Promise.all(
            mapsSnap.docs.map(async (doc) => {
                const data = doc.data();
                const [skillsSnap, connsSnap] = await Promise.all([
                    doc.ref.collection("skills").get(),
                    doc.ref.collection("connections").get(),
                ]);
                return {
                    id: doc.id,
                    title: data.title,
                    description: data.description,
                    createdAt: data.createdAt.toDate().toISOString(),
                    updatedAt: data.updatedAt.toDate().toISOString(),
                    skills: skillsSnap.docs.map((s) => {
                        const d = s.data();
                        return {
                            id: s.id,
                            name: d.name,
                            category: d.category,
                            level: d.level,
                        };
                    }),
                    connections: connsSnap.docs.map((c) => {
                        const d = c.data();
                        return {
                            id: c.id,
                            sourceId: d.sourceId,
                            targetId: d.targetId,
                            type: d.type,
                        };
                    }),
                };
            }),
        );
        return Response.json({ maps });
    } catch (err) {
        console.error("GET /api/maps error:", err);
        return errorResponse(500, "INTERNAL_ERROR", "Failed to fetch maps");
    }
}

//posts-
export async function POST(request: Request) {
    const decoded = await verifyRequest(request);
    if (!decoded) {
        return errorResponse(401, "UNAUTHENTICATED", "Invalid or missing token");
    }

    const uid = decoded.uid;

    let body: unknown;

    try {
        body = await request.json();
    }

    catch {
        return errorResponse(400, "INVALID_INPUT", "Request body must be JSON");
    }

    const { title, description } = body as Record<string, unknown>;

    if (!isNonEmptyString(title)) {
        return errorResponse(400, "INVALID_INPUT", "Title is required");
    }

    try {
        const now = Timestamp.now();
        const mapData = {
            title: title.trim(),
            description: typeof description === "string" ? description : "",
            createdAt: now,
            updatedAt: now,
            deletedAt: null,
        };

        const docRef = await adminDb
            .collection(`users/${uid}/maps`)
            .add(mapData);

        // Log activity only AFTER successful write.
        await logActivity(uid, docRef.id, `Created ${mapData.title}`);

        return Response.json(
            {
                map: {
                    id: docRef.id,
                    title: mapData.title,
                    description: mapData.description,
                    createdAt: now.toDate().toISOString(),
                    updatedAt: now.toDate().toISOString(),
                    skills: [],
                    connections: [],
                },
            },
            { status: 201 },
        );
    } catch (err) {
        console.error("POST /api/maps error:", err);
        return errorResponse(500, "INTERNAL_ERROR", "Failed to create map");
    }




}