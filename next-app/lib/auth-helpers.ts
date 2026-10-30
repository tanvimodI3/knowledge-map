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
        if (process.env.FIREBASE_AUTH_EMULATOR_HOST || process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true") {
            const parts = token.split(".");
            if (parts.length !== 3) return null;
            const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as Record<string, unknown>;
            const uid = typeof payload.user_id === "string" ? payload.user_id : typeof payload.sub === "string" ? payload.sub : null;
            const exp = typeof payload.exp === "number" ? payload.exp : 0;
            if (!uid || exp * 1000 <= Date.now()) return null;
            return { ...payload, uid } as unknown as DecodedIdToken;
        }
        return await adminAuth.verifyIdToken(token);
    } catch {
        return null;
    }
}
