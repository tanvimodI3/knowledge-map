import { applicationDefault, initializeApp, getApps, cert, type ServiceAccount } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

// Initialise once — safe across hot reloads.
if (!getApps().length) {
    const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "demo-knowledge-map";
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
    const applicationCredentials = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    const firestoreEmulator = process.env.FIRESTORE_EMULATOR_HOST;

    if (firestoreEmulator || process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true") {
        initializeApp({ projectId });
    } else if (projectId && clientEmail && privateKey) {
        const sa: ServiceAccount = {
            projectId,
            clientEmail,
            privateKey,
        };
        initializeApp({ credential: cert(sa) });
    } else if (applicationCredentials) {
        initializeApp({ credential: applicationDefault(), projectId });
    } else {
        // Project ID alone is enough for Firebase client config, but it does not authenticate server writes.
        // A host environment's Application Default Credentials may be configured outside this process.
        initializeApp(projectId ? { projectId } : undefined);
    }
}

/** Firestore instance for all server-side reads/writes. */
export const adminDb = getFirestore();

/** Auth instance for verifying ID tokens. */
export const adminAuth = getAuth();
