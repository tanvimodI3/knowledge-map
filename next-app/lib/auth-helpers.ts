import type { DecodedIdToken } from "firebase-admin/auth";
import { adminAuth } from "./firebase-admin";

/**
 * Extract and verify the Firebase ID token from the Authorization header.
 * Returns the decoded token (with `uid`) on success, or `null` on failure.
 */
export async function verifyRequest(
    request: Request,
): Promise<DecodedIdToken | null> {
    const header = request.headers.get("Authorization");
    if (!header?.startsWith("Bearer ")) return null;

    const token = header.slice(7); // strip "Bearer "
    try {
        return await adminAuth.verifyIdToken(token);
    } catch {
        return null;
    }
}
