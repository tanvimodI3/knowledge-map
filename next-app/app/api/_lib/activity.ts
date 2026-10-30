import { adminDb } from "@/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";

/**
 * Append an activity event and trim the collection to the latest 20 docs.
 * Call this ONLY after the main operation has succeeded.
 */
export async function logActivity(
    uid: string,
    mapId: string,
    message: string,
): Promise<void> {
    const col = adminDb.collection(`users/${uid}/activity`);

    try {
        await col.add({
            mapId,
            message,
            at: Timestamp.now(),
        });

        // Trim: keep latest 20, delete the rest.
        const all = await col.orderBy("at", "desc").get();
        if (all.size > 20) {
            const batch = adminDb.batch();
            all.docs.slice(20).forEach((doc) => batch.delete(doc.ref));
            await batch.commit();
        }
    } catch (error) {
        // Activity is supplementary. A credential/database outage must not convert
        // a successful map, skill, or connection mutation into a failed mutation.
        console.error("Failed to record activity:", error);
    }
}
