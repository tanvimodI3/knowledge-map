---
description: "Use when planning or implementing the Personal Knowledge Map backend, API, persistence, Firebase authentication, or splitting backend work into groups."
---

# Backend Todo List

Keep the backend lightweight and aligned with the Personal Knowledge Map goals in [`personal_knowledge_map_project_context.md`](../../personal_knowledge_map_project_context.md). The app currently has Firebase Authentication and an in-memory maps store; map data resets on refresh. Do not present mock or in-memory data as persistent.

## Group 1 — API and backend

- [ ] Define and document the API transport, request/response shapes, error format, authentication header, and transaction boundaries with Group 2 before implementation.
- [ ] Own the server/API entry points, request and response contracts, input validation, authorization checks, and backend tests.
- [ ] Cover the map operations currently exposed by `useMaps` in `next-app/context/maps-context.tsx`: list, create, delete/restore, add/remove skills, and add/remove connections. Include recent activity only if it can be recorded consistently with those operations.
- [ ] Scope every read and write to the authenticated user. Verify the Firebase ID token on the server for every protected operation; a client-side route guard is not authorization.
- [ ] Validate map ownership and referenced skill/map IDs server-side. Reject malformed input, self-connections, invalid relation types, and duplicate connections using explicit client-safe errors.
- [ ] Make adding a skill and its initial connections atomic where the selected storage supports it.
- [ ] Document endpoint or error-contract changes and provide focused tests for authorization, validation, and successful operations.

## Group 2 — Database and authentication integration

- [ ] Coordinate the API transport, request/response shapes, error format, authentication header, and transaction boundaries with Group 1 before implementation.
- [ ] Own the persistent data model, indexes/rules or access policies, Firebase token integration, and frontend-to-backend persistence wiring.
- [ ] Use the existing Firebase Authentication identity. Obtain and send the current user's ID token for protected API calls; never send or store a Firebase password in the app's data layer.
- [ ] Ensure every persisted map, skill, connection, and activity record is associated with its owning user directly or through a verified parent map. Enforce ownership in database rules/queries as well as relying on API checks.
- [ ] Replace the in-memory seed/store behavior in `next-app/context/maps-context.tsx` with the agreed backend contract. Keep the `KnowledgeMap`, `Skill`, `Connection`, and `ActivityItem` shapes in `next-app/lib/knowledge-map/types.ts` as the frontend contract unless both groups agree on a deliberate, documented migration.
- [ ] Add loading and error states for persistence operations. Do not silently fall back to seed data or report success when a request fails.
- [ ] Add focused tests or a documented verification procedure for user isolation, persistence across refresh, and sign-in/sign-out behavior.

## Shared checklist

- Group 1 owns API semantics; Group 2 owns persistence and client integration. Keep the contract documented and have both groups implement against it.
- Use the current map domain fields as the baseline: map `id`, `title`, `description`, `skills`, `connections`, `createdAt`, `updatedAt`; skill `id`, `name`, `category`, `level`; connection `id`, `sourceId`, `targetId`, `type`.
- Keep prerequisite edges directed (`sourceId` is the prerequisite and `targetId` depends on it); related edges are undirected in meaning.
- Coordinate edits to `next-app/context/maps-context.tsx`, `next-app/lib/knowledge-map/types.ts`, environment examples, and dependency manifests. Assign one group to own each shared file or agree on changes before editing to avoid conflicts.
- Do not commit real credentials, service-account keys, user tokens, or private data. Document required environment variable names and provide placeholders only.
- Keep backend changes limited to the required app behavior. Do not add AI, collaboration, scraping, or other optional services without an explicit project decision.

## Done when

- [ ] Both groups have implemented against the same documented contract.
- [ ] A user's maps and child records persist after refresh and cannot be read or changed by another user.
- [ ] Create, delete/restore, skill, and connection operations return clear results and surface failures.
- [ ] Relevant type-checks, tests, and production build pass; any unavailable external-service setup is stated explicitly.
