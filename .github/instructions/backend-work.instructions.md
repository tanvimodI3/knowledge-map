---
description: "Use when planning or implementing the Personal Knowledge Map backend, API endpoints, Firestore persistence, Firebase authentication, or dividing backend work into groups."
---

# Backend Todo List

Keep the backend small and aligned with [`personal_knowledge_map_project_context.md`](../../personal_knowledge_map_project_context.md). Maps currently live in React memory and are lost on refresh. The aim is to persist the current app's maps and skills, not to add unrelated services.

## Shared plan: agree before coding

- Use Next.js Route Handlers under `next-app/app/api/` for the HTTP API.
- Use Firestore for persistent data, with Firebase Authentication for identity. If the groups choose a different database, update this document with the equivalent collections/tables and ownership rules before implementation.
- The browser sends the Firebase ID token in the `Authorization` header on every protected request. The server verifies the token and gets the user ID from the verified token. Never accept a user ID from the request body as proof of identity.
- JSON API responses use the current frontend shapes in `next-app/lib/knowledge-map/types.ts`. API date fields are ISO 8601 strings, even if Firestore stores dates as timestamps.
- Agree on this contract before building either side. Group 1 owns the HTTP behavior; Group 2 owns Firestore and the client persistence wiring.

## Group 1 — API and backend

- [ ] Add the Route Handlers and implement the endpoints below. Every endpoint requires a valid Firebase ID token.
- [ ] Look up data only inside the verified user's Firestore path. Return `404` for a map or child record the user does not own.
- [ ] Validate request bodies. Return `400` for missing or invalid fields, `401` for a missing/invalid token, `404` for a missing resource, `409` for a duplicate connection, and `500` for unexpected server errors. Never return stack traces or credentials.
- [ ] Use one error shape everywhere: `{ "error": { "code": "INVALID_INPUT", "message": "A short safe explanation" } }`. Use suitable codes such as `UNAUTHENTICATED`, `NOT_FOUND`, `DUPLICATE_CONNECTION`, and `INTERNAL_ERROR`.
- [ ] Make creating a skill and all its initial connections one Firestore transaction/batch. If it fails, save none of them.
- [ ] Write focused tests for missing/invalid tokens, access to another user's IDs, invalid inputs, duplicate/self-connections, successful requests, and atomic skill creation.

### Endpoints and JSON

`GET /api/maps`

- Return all non-deleted maps belonging to the signed-in user.
- Response: `{ "maps": [KnowledgeMap] }`. Each map includes its `skills` and `connections` arrays.

`POST /api/maps`

- Request: `{ "title": "Machine Learning", "description": "Optional description" }`
- Require a non-empty title. If description is omitted, store an empty string.
- Response: `{ "map": KnowledgeMap }` with a server-generated ID and timestamps.

`GET /api/maps/{mapId}`

- Return one map, including its skills and connections.
- Response: `{ "map": KnowledgeMap }`.

`DELETE /api/maps/{mapId}`

- Soft-delete the map by setting `deletedAt`; do not erase it immediately, so Undo can work.
- Response: `{ "mapId": "…", "deleted": true }`.
- Deleted maps are omitted from `GET /api/maps` and normal map reads.

`PATCH /api/maps/{mapId}`

- Restore a soft-deleted map. Request: `{ "deleted": false }`.
- Clear `deletedAt` and return `{ "map": KnowledgeMap }`.
- Do not accept arbitrary map fields through this route unless both groups document and implement that feature.

`POST /api/maps/{mapId}/skills`

- Request: `{ "name": "Probability", "category": "Math", "level": "beginner", "links": [{ "skillId": "existing-skill-id", "choice": "needs" }] }`
- `level` must be `beginner`, `intermediate`, or `advanced`. `choice` must be `needs`, `leads-to`, or `related`. `links` may be empty.
- Create the skill and all requested links atomically.
- Response: `{ "skill": Skill, "connections": [Connection] }`.

`DELETE /api/maps/{mapId}/skills/{skillId}`

- Delete the skill and every connection that references it.
- Response: `{ "skillId": "…", "deleted": true }`.

`POST /api/maps/{mapId}/connections`

- Request: `{ "sourceId": "skill-id", "targetId": "other-skill-id", "type": "prerequisite" }`
- `type` must be `prerequisite` or `related`. Both skills must belong to this map. Reject self-links and duplicate links (including reversed duplicates for `related`).
- Response: `{ "connection": Connection }`.

`DELETE /api/maps/{mapId}/connections/{connectionId}`

- Delete the connection.
- Response: `{ "connectionId": "…", "deleted": true }`.

`GET /api/activity?limit=20`

- Return the signed-in user's latest activity, capped at 20 entries.
- Response: `{ "activity": [ActivityItem] }`.
- Record events for map creation/deletion/restoration, skill creation/removal, and connection creation/removal. If an operation fails, do not write a success event.

### Connection direction

- A `prerequisite` connection is directed: `sourceId` is what must be learned first; `targetId` depends on it.
- A `related` connection is undirected in meaning. Keep one stored pair only and treat `(A, B)` and `(B, A)` as duplicates.
- For skill creation links: `needs` means the existing skill is the prerequisite of the new skill; `leads-to` means the new skill is the prerequisite of the existing skill; `related` creates an undirected relationship.

## Group 2 — Database and authentication integration

- [ ] Create the Firestore data described below. Keep all user records under that user's UID.
- [ ] Set up server-side Firebase Admin token verification for Group 1. Keep Admin credentials on the server only; never expose a service-account key or admin credential to the browser.
- [ ] Set Firestore rules to deny direct client reads/writes if all access goes through the authenticated API. Server routes must still check map ownership because Admin SDK operations bypass Firestore rules.
- [ ] Replace the in-memory data in `next-app/context/maps-context.tsx` with calls to the agreed API. Send the current user's ID token and update React state only from successful API responses.
- [ ] Add visible loading/error behavior. Do not fall back to seed maps or report an operation as successful when an API call fails.
- [ ] Verify that data remains after refresh and that a second signed-in user cannot read, change, restore, or delete the first user's records.

### Firestore collections and fields

Use this layout:

```text
users/{uid}/maps/{mapId}
users/{uid}/maps/{mapId}/skills/{skillId}
users/{uid}/maps/{mapId}/connections/{connectionId}
users/{uid}/activity/{activityId}
```

- `uid`, `mapId`, `skillId`, `connectionId`, and `activityId` are document IDs; generate IDs on the server.
- Map document fields: `title` (string), `description` (string), `createdAt` (timestamp), `updatedAt` (timestamp), `deletedAt` (timestamp or null).
- Skill document fields: `name` (string), `category` (string), `level` (`beginner`, `intermediate`, or `advanced`), `createdAt` (timestamp).
- Connection document fields: `sourceId` (string), `targetId` (string), `type` (`prerequisite` or `related`), `createdAt` (timestamp).
- Activity document fields: `mapId` (string), `message` (string), `at` (timestamp). Store the newest first when reading; keep at most the latest 20 if activity is stored only for this dashboard.
- The parent map path establishes ownership for skills and connections. The user path establishes ownership for maps and activity. Every API read/write must derive this path from the verified token, not a client-supplied UID.
- When returning a map through the API, assemble the map document and its child skill/connection documents into the frontend `KnowledgeMap` shape. Convert timestamps into ISO strings.

## Shared completion checklist

- [ ] Both groups use the endpoint and Firestore contract above, or update it together before implementation.
- [ ] Every protected route verifies the token and scopes reads/writes to the verified UID.
- [ ] Map, skill, connection, and activity data survives refresh and is isolated between users.
- [ ] Create, delete/restore, skill, and connection actions show errors instead of false success.
- [ ] Focused tests, type-check, and production build pass. State clearly if a test requires Firebase setup that is unavailable locally.
- [ ] `.env.example` documents variable names with placeholders only. Never commit real tokens, passwords, or service-account keys.
- [ ] Keep work limited to the current app needs; do not add AI, collaboration, scraping, or other optional services without an explicit project decision.
