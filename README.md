# MicroVibe

MicroVibe is a Vibe Coding starter kit for building web apps fast with a minimal runtime, file-based routing and JSX.

## Why MicroVibe

MicroVibe is designed for builders who want:

- File-based routing without heavy framework overhead.
- API routes and page routes in one simple project structure.
- SSR by default, with per-route client mode when interactivity is needed.
- A runtime small enough to understand and modify.

It combines:

- `packages/microvibe`: the runtime/CLI used to serve MicroVibe apps.
- `packages/create-microvibe`: the scaffold generator for new apps.

Core idea:

- Start from a working app in seconds
- Iterate directly in routes and components
- Keep defaults simple, responsive, and easy to customize

## Who This Is For

- Developers who like JSX and want fast local iteration.
- Teams validating product ideas without full framework complexity.
- Contributors who prefer explicit runtime behavior over black-box tooling.

## Community and Contribution

- Start with docs and examples, then open issues with concrete repro steps.
- For first contributions, focus on routing, API behavior, docs, and starter DX.
- `docs/SHOW_HN.md` contains a launch post draft and a practical HN rollout checklist.

## Workspace Structure

```text
microvibe/
  package.json
  packages/
    microvibe/
      bin/microvibe.js
      src/server.tsx
    create-microvibe/
      bin/create-microvibe.js
      template/
```

## Prerequisites

- Node.js 18+ (recommended: latest LTS)
- npm 9+

## Quick Start (Create and Run an Example App)

From this repository root:

```bash
node ./packages/create-microvibe/bin/create-microvibe.js my-app
cd my-app
npm install
npm run dev
```

Open:

- `http://127.0.0.1:3020`
- `http://127.0.0.1:3020/api/health`
- `http://127.0.0.1:3020/api/highlights`

## 2-Minute End-to-End Demo

Build one route + one component + one API endpoint + one fetch flow.

1. Create a component in `Components/GreetingCard.jsx`:

```jsx
/** @jsx h */
import { h } from "preact";

export default function GreetingCard({ text }) {
  return <p>{text}</p>;
}
```

2. Create an API route in `api/demo.js`:

```js
export function GET({ json }) {
  json(200, [{ id: 1, mensaje: "Hola desde MicroVibe API" }]);
}
```

3. Create a page route in `routes/demo.jsx`:

```jsx
/** @jsx h */
import { h } from "preact";
import GreetingCard from "../Components/GreetingCard";

export const mode = "client";

export default function DemoPage() {
  async function load() {
    const res = await fetch("/api/demo");
    const data = await res.json();
    console.log(data);
  }

  return (
    <section>
      <h2>Demo Route</h2>
      <GreetingCard text="Route + Component + API connected." />
      <button type="button" onClick={load}>
        Fetch /api/demo
      </button>
    </section>
  );
}
```

4. Open `http://127.0.0.1:3020/demo` and click the button.  
5. Verify the API directly at `http://127.0.0.1:3020/api/demo`.

## Run with Local `microvibe` CLI

Inside your generated app directory:

```bash
cd my-app
npm install
node ../packages/microvibe/bin/microvibe.js dev
```

## Generated App Template

The scaffold currently generates:

- `routes/_app.jsx`: global app shell and route metadata output.
- `routes/index.jsx`: starter route with technical guidance.
- `routes/users/[id].jsx`: dynamic route example using `params.id`.
- `Components/AlertBox.jsx`: interactive client component example.
- `api/health.js`: sample API endpoint.
- `api/highlights.js`: sample JSON array endpoint (Spanish content).
- `public/app.css`: responsive, neutral baseline styles.
- `public/client.entry.js`: client hydration entry.
- `server.tsx`: local server runtime entry (generated from `packages/microvibe/src/server.tsx`).
- `.microvibe/runtime/*`: internal runtime helpers used by `server.tsx` (`api.ts`, `router.ts`, `route-params.ts`, `module-loader.ts`).

## Keep Your Focus on App Code

Generated apps include a hidden runtime folder:

- `.microvibe/runtime/`

Think of this like framework internals. In day-to-day app work, you usually don't need to touch it.
Most changes should happen in:

- `routes/`
- `Components/`
- `api/`
- `public/`

## What's Better Now (Routing + API)

- Routes resolve in a predictable way:
  static routes win over dynamic ones, and dynamic ones win over catch-all routes.
- Dynamic routing supports:
  `[id]`, `[...slug]`, and `[[...slug]]`.
- You can validate route params when needed:
  return `400` for invalid input, or `404` when the resource doesn't exist.
- API routes now respond with clearer method errors:
  `405 Method Not Allowed` includes the `Allow` header.
- API errors use one JSON shape:
  `{ ok: false, code, error }`.
- Runtime module loading is cached and auto-invalidated when files change,
  so local development stays fast without stale code.

## Editing Guide

- Add route files in `/routes`.
- Add reusable UI components in `/Components`.
- Add API handlers in `/api`.
- Start by editing `/routes/index.jsx`.

## Client Mode (`mode = "client"`)

Use `export const mode = "client";` in a route when it needs client-side behavior (for example, interactive components with state).
If a route does not declare `mode = "client"`, it runs as SSR by default.
`mode` is defined per route file (`routes/*.jsx`), and the components used by that route follow the same rendering context.

Example:

```jsx
export const mode = "client";
```

The starter `routes/index.jsx` already includes this mode so components like `AlertBox` can run interaction logic in the browser.

## Routing by Folders (File-Based Routing)

MicroVibe resolves routes from files and folders inside `/routes`.

Examples:

- `/` -> `routes/index.jsx`
- `/about` -> `routes/about.jsx`
- `/blog` -> `routes/blog/index.jsx`
- `/blog/post` -> `routes/blog/post.jsx`

Dynamic segments:

- `/users/:id` -> `routes/users/[id].jsx`
- `/blog/:slug` -> `routes/blog/[slug].jsx`

Use `routes/_app.jsx` as the shared app shell for all routes.

## Monorepo Scripts

From repo root:

```bash
npm run dev:runtime
```

This runs the runtime workspace script:

- `packages/microvibe` -> `npm run dev`

## Troubleshooting

### `Cannot find package 'preact'`

Install dependencies in the generated app:

```bash
cd my-app
npm install
```

### npm cache permission issue (`EPERM` on `~/.npm`)

Use a project-local cache:

```bash
npm install --cache .npm-cache
```

### Network resolution issue (`ENOTFOUND registry.npmjs.org`)

Check network/proxy and force the official registry:

```bash
npm config set registry https://registry.npmjs.org/
npm install --cache .npm-cache
```
