import { FirebaseError } from "firebase/app";

const MESSAGES: Record<string, string> = {
  "auth/invalid-email": "That email address doesn't look right.",
  "auth/user-disabled": "This account has been disabled.",
  "auth/user-not-found": "No account matches that email.",
  "auth/wrong-password": "Incorrect password. Try again.",
  "auth/invalid-credential": "Incorrect email or password.",
  "auth/email-already-in-use": "An account with this email already exists.",
  "auth/weak-password": "Choose a password with at least 6 characters.",
  "auth/operation-not-allowed": "Google sign-in is not enabled in your Firebase Console. Please enable it under Authentication -> Sign-in method.",
  "auth/unauthorized-domain": "This domain is not authorized in Firebase Console -> Authentication -> Settings -> Authorized domains.",
  "auth/configuration-not-found": "Firebase Auth project configuration missing. Check your Google provider setup in Firebase Console.",
  "auth/invalid-api-key": "Invalid Firebase API key. Please check your .env.local configuration.",
  "auth/popup-closed-by-user": "Sign-in was cancelled.",
  "auth/too-many-requests": "Too many attempts. Wait a moment and try again.",
  "auth/network-request-failed": "Network error. Check your connection.",
};

export function getAuthErrorMessage(error: unknown): string {
  if (error instanceof FirebaseError) {
    return MESSAGES[error.code] ?? `Firebase error (${error.code}): ${error.message}`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Something went wrong. Please try again.";
}