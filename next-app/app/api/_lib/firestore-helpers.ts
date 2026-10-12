import { adminDb } from "@/lib/firebase-admin";
import type { KnowledgeMap } from "@/lib/knowledge-map/types";
import type {
    DocumentSnapshot,
    DocumentReference,
} from "firebase-admin/firestore";

/**
 * Read a map document reference and assemble the full KnowledgeMap shape
 * including skills and connections subcollections.
 *
 * Returns `null` if the document doesn't exist or is soft-deleted.
 */
export async function assembleMap(
    mapRef: DocumentReference,
): Promise<KnowledgeMap | null> {
    const mapSnap = await mapRef.get();
    if (!mapSnap.exists) return null;

    const data = mapSnap.data()!;

    // Treat soft-deleted maps as not found.
    if (data.deletedAt !== null) return null;

    const [skillsSnap, connsSnap] = await Promise.all([
        mapRef.collection("skills").get(),
        mapRef.collection("connections").get(),
    ]);

    return {
        id: mapSnap.id,
        title: data.title,
        description: data.description,
        createdAt: data.createdAt.toDate().toISOString(),
        updatedAt: data.updatedAt.toDate().toISOString(),
        skills: skillsSnap.docs.map((s) => {
            const d = s.data();
            return { id: s.id, name: d.name, category: d.category, level: d.level };
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
}

/**
 * Get the Firestore reference to a user's map document.
 */
export function mapRef(uid: string, mapId: string) {
    return adminDb.doc(`users/${uid}/maps/${mapId}`);
}
