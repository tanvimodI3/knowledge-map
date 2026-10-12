import { initializeApp, getApps, cert, type ServiceAccount } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

// Initialise once — safe across hot reloads.
if (!getApps().length) {
    const sa: ServiceAccount = {
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        // .env stores the key with literal "\n" — turn them into real newlines.
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    };

    initializeApp({ credential: cert(sa) });
}

/** Firestore instance for all server-side reads/writes. */
export const adminDb = getFirestore();

/** Auth instance for verifying ID tokens. */
export const adminAuth = getAuth();
