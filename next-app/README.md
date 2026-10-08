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

## Knowledge maps

The authenticated `/dashboard` route lists maps, summary statistics, category
insights, and recent activity. Create a map to open `/dashboard/maps/[mapId]`,
where skills can be added, linked, searched, and removed.

Map data currently lives in React state and resets on refresh. The store,
types, and backend integration points are in `context/maps-context.tsx` and
`lib/knowledge-map/`; replace the marked `BACKEND:` state operations with
user-scoped API calls when a backend is available.

UI components use the Base UI shadcn preset. Add additional components with:

```sh
npx shadcn@latest add <component>
```
