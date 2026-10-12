/**
 * Standard error codes used across the entire API.
 * Keep this union in sync with the backend-work instructions.
 */
export type ErrorCode =
    | "UNAUTHENTICATED"
    | "INVALID_INPUT"
    | "NOT_FOUND"
    | "DUPLICATE_CONNECTION"
    | "INTERNAL_ERROR";

/**
 * Build a JSON `Response` with the shared error envelope:
 * `{ "error": { "code": "...", "message": "..." } }`
 */
export function errorResponse(
    status: number,
    code: ErrorCode,
    message: string,
): Response {
    return Response.json({ error: { code, message } }, { status });
}
