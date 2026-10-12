import { initializeApp, getApps, cert, type ServiceAccount } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

// Initialise once — safe across hot reloads.
if (!getApps().length) {
    const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

    if (projectId && clientEmail && privateKey) {
        const sa: ServiceAccount = {
            projectId,
            clientEmail,
            privateKey,
        };
        initializeApp({ credential: cert(sa) });
    } else {
        // Fallback: initialize with project ID if available (useful for local emulator or default credentials)
        initializeApp(projectId ? { projectId } : undefined);
    }
}

/** Firestore instance for all server-side reads/writes. */
export const adminDb = getFirestore();

/** Auth instance for verifying ID tokens. */
export const adminAuth = getAuth();
