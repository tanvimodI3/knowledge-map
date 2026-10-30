# Personal Knowledge Map

A Next.js app for organizing skills and concepts as connected knowledge maps.
Sign in or create an account with Firebase, then use the dashboard to create
maps, add skills, explore prerequisite/related connections, and track map
activity.

## Development

Run the app from this directory:

```sh
npm install
npm run dev
```

Set the Firebase values in `.env.local` using `.env.example` as a template.
Enable Email/Password and (if desired) Google sign-in in Firebase Authentication.

The browser uses the Firebase client configuration. API routes require a
verified Firebase ID token and use Firebase Admin credentials server-side.
For local emulator development, set all emulator variables from
`.env.example` and start both auth and Firestore emulators:

```sh
npm run emulators
```

## Knowledge maps

The authenticated `/dashboard` route lists maps, summary statistics, category
insights, and recent activity. Create a map to open `/dashboard/maps/[mapId]`,
where skills can be added, linked, searched, and removed.

Authenticated map data is loaded and persisted through the Next.js API routes
under `app/api/`. The client sends the current Firebase ID token in the
`Authorization` header; server routes derive ownership from the verified UID.

UI components use the Base UI shadcn preset. Add additional components with:

```sh
npx shadcn@latest add <component>
```
