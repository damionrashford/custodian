# Tech stack — Bun + React Router + Tailwind v4

Load when: STEP 9 (Emit) is producing code (not just markup/advice), OR when the user asks "how do I set this up" / "scaffold this" / "show me the project structure".

Contains two architectures. Default to Architecture A. Use B only when the user explicitly requires SSR or file-based routes.

## Live docs available (verify APIs mid-emit, don't guess)

The library has live mirrored docs for both core dependencies. Use Pattern E (`delegation-patterns.md`) when you need to verify a specific API surface before writing code:

```bash
# Verify a React Router API / component / hook / convention
bun ${CLAUDE_SKILL_DIR}/scripts/library/search.ts --book react-router "<API>" --limit 3

# Verify a Tailwind utility class / theme variable / CSS-first config
bun ${CLAUDE_SKILL_DIR}/scripts/library/search.ts --book tailwind "<utility>" --limit 3
```

If the doc isn't indexed yet (search returns exit-code 3 for that book), one-time setup:
```bash
bun ${CLAUDE_SKILL_DIR}/scripts/library/fetch-tech-docs.ts          # both sources, ~3 min
bun ${CLAUDE_SKILL_DIR}/scripts/library/embed.ts --book react-router
bun ${CLAUDE_SKILL_DIR}/scripts/library/embed.ts --book tailwind
```

**Always verify before guessing.** The official docs change every release; training data ages. For any non-trivial API call (`createBrowserRouter` opts, `loader` typing, `useNavigate` signature, a v4 Tailwind utility you're uncertain about), spawn a Pattern E lookup.

---

## Architecture A — Bun-native (DEFAULT)

One runtime, one bundler, one HMR system. No Vite. Production builds compile to a single binary.

### Stack

| Layer | Tool | Version |
|---|---|---|
| Runtime | Bun | latest |
| Bundler | Bun (built-in) | — |
| Routing | `react-router` v7 (Data Mode) | latest |
| Styling | Tailwind v4 via `bun-plugin-tailwind` | latest |
| Dev server | `Bun.serve` with `development: true` | — |
| Production | `bun build --target=bun --production` OR `bun build --compile` (single-file) | — |

### Scaffolding sequence

Execute in order. Each command is atomic and idempotent:

```bash
# 1. Initialize project
mkdir my-app && cd my-app
bun init -y

# 2. Install runtime deps
bun add react react-dom react-router

# 3. Install dev deps (Tailwind + plugin)
bun add -d bun-plugin-tailwind tailwindcss @types/react @types/react-dom
```

### Files to create

**`bunfig.toml`** — wire the Tailwind plugin into the bundler:
```toml
[serve.static]
plugins = ["bun-plugin-tailwind"]
```

**`tsconfig.json`** — JSX + bundler-aware module resolution:
```json
{
  "compilerOptions": {
    "lib": ["ESNext", "DOM"],
    "target": "ESNext",
    "module": "ESNext",
    "moduleDetection": "force",
    "jsx": "react-jsx",
    "allowJs": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "noEmit": true,
    "strict": true,
    "skipLibCheck": true,
    "noFallthroughCasesInSwitch": true,
    "allowSyntheticDefaultImports": true,
    "forceConsistentCasingInFileNames": true,
    "types": ["bun-types"]
  },
  "include": ["**/*.ts", "**/*.tsx"]
}
```

**`index.html`** — entry HTML, references Tailwind via the magic `tailwindcss` href:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>App</title>
    <link rel="stylesheet" href="tailwindcss" />
    <link rel="stylesheet" href="./app.css" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./src/main.tsx"></script>
  </body>
</html>
```

**`app.css`** — Tailwind v4 is CSS-first (no JS config). Theme tokens go in `@theme` directives:
```css
@import "tailwindcss";

@theme {
  --color-primary: #2665fd;
  --color-foreground: #0f172a;
  --color-background: #ffffff;
  --font-display: "Söhne", system-ui, sans-serif;
  --font-body: "Söhne", system-ui, sans-serif;
  --radius-base: 8px;
}
```

**`src/main.tsx`** — entry point + router setup:
```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router";
import { routes } from "./routes";

const router = createBrowserRouter(routes);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
```

**`src/routes.tsx`** — config-based routes with loaders/actions (Data Mode):
```tsx
import type { RouteObject } from "react-router";
import { Home } from "./pages/Home";
import { Dashboard } from "./pages/Dashboard";
import { ErrorPage } from "./pages/ErrorPage";

export const routes: RouteObject[] = [
  {
    path: "/",
    element: <Home />,
    errorElement: <ErrorPage />,
    loader: async () => {
      // pre-render data
      return { hello: "world" };
    },
  },
  {
    path: "/dashboard",
    element: <Dashboard />,
    loader: async () => {
      const res = await fetch("/api/stats");
      return res.json();
    },
  },
];
```

**`server.ts`** — Bun.serve dev + production hub. HTML import is the magic:
```ts
import index from "./index.html";

const server = Bun.serve({
  routes: {
    // Every non-API route serves the SPA shell; client-side router takes over
    "/*": index,

    // API endpoints (Bun v1.2.3+)
    "/api/stats": {
      async GET() {
        return Response.json({ users: 42, sessions: 17 });
      },
    },
  },

  // development:true enables HMR, sourcemaps, detailed errors
  development: process.env.NODE_ENV !== "production",
});

console.log(`Listening on ${server.url}`);
```

### Run commands

```bash
# Dev with HMR
bun --hot server.ts

# Production build (bundle once, no runtime bundling)
bun build server.ts --target=bun --production --outdir=dist

# Single-file binary (deploy anywhere; Bun runtime + app in one executable)
bun build --compile --target=bun ./server.ts --outfile dist/app

# Run the production build
NODE_ENV=production bun dist/server.js
# OR (single-file):
./dist/app
```

### Hardlines for Architecture A

- **`<link rel="stylesheet" href="tailwindcss" />`** — that string `tailwindcss` is not a typo. `bun-plugin-tailwind` resolves it. Do not change.
- **`@import "tailwindcss"`** — required in your CSS file. v4 dropped the `@tailwind base/components/utilities` directives.
- **Tailwind theme via `@theme` block in CSS** — not `tailwind.config.js`. v4 is CSS-first.
- **Bun.serve `routes` (not `fetch` for path matching)** — the routes object handles HTML imports + API endpoints declaratively. Use `fetch` only as a fallback.
- **`createBrowserRouter`, not `BrowserRouter`** — Data Mode requires the factory + `RouterProvider`. Don't mix with declarative `<BrowserRouter>`.
- **Single primary action per view** still applies (see `composition.md`).

### When this stack is wrong

Switch to Architecture B if any of these are true:
- User says "SSR" / "server-side rendering" / "for SEO"
- User says "file-based routes" / "Remix-style"
- User wants `loader` to run on the server, not in the browser
- Project will deploy on a platform that requires Vite output (some Vercel templates)

---

## Architecture B — Vite path (when SSR is required)

React Router Framework Mode with Vite. Bun is reduced to script runner + installer.

### Scaffolding sequence

```bash
# 1. Scaffold (interactive; defaults are fine)
bunx create-react-router@latest my-app
cd my-app

# 2. Use Bun for deps
bun install

# 3. Add Tailwind
bun add @tailwindcss/vite tailwindcss
```

### Files to modify

**`vite.config.ts`** — plug in Tailwind + React Router + ts paths:
```ts
import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [
    tailwindcss(),
    reactRouter(),
    tsconfigPaths(),
  ],
});
```

**`app/app.css`** — Tailwind import + theme:
```css
@import "tailwindcss";

@theme {
  --color-primary: #2665fd;
  /* ... */
}
```

**`app/root.tsx`** — already scaffolded; just ensure `app.css` is imported and `<Links />` is in `<head>`:
```tsx
import "./app.css";
// rest from create-react-router template
```

**`react-router.config.ts`** — toggle SSR vs SPA:
```ts
import type { Config } from "@react-router/dev/config";

export default {
  ssr: true,        // false → SPA mode (still uses Vite)
} satisfies Config;
```

**`app/routes.ts`** — config-based route declarations (file-based works too via co-located files):
```ts
import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("dashboard", "routes/dashboard.tsx"),
] satisfies RouteConfig;
```

**`app/routes/home.tsx`** — route with loader (runs on server in SSR mode):
```tsx
import type { Route } from "./+types/home";

export async function loader({ request }: Route.LoaderArgs) {
  return { hello: "world" };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  return (
    <h1 className="text-3xl font-bold underline">
      Hello {loaderData.hello}
    </h1>
  );
}
```

### Run commands

```bash
bun --bun run dev      # Vite dev server via Bun
bun --bun run build    # production build (server + client)
bun --bun run start    # production server
```

### Hardlines for Architecture B

- **`bun --bun` prefix on every script** — without `--bun`, Bun would defer to Node, which is slower and not the point.
- **`reactRouter()` must come AFTER `tailwindcss()`** in the Vite plugin array — order matters.
- **`.client` / `.server` module conventions** — files named `*.client.tsx` only run in the browser; `*.server.tsx` only on the server.
- **`react-router.config.ts` is the SSR toggle** — not code-level. Setting `ssr: false` gives you SPA mode with the framework conventions intact.

---

## Decision flow

```
Did the user say "SSR" / "server-side rendering" / "for SEO" / "file-based routes" / "loader on server"?
  YES → Architecture B
  NO  → Architecture A
```

When in doubt, ask once: *"SPA (Bun-native, faster dev, single-binary deploy) or SSR (Vite-based, slower but server-rendered)?"*

## Tailwind v4 token integration with the studio palette

When STEP 3 (Color) decided the 5-token palette, port it into the Tailwind v4 `@theme` block. The names are stable across architectures.

```css
@import "tailwindcss";

@theme {
  /* From state.color.palette */
  --color-background: <hex>;
  --color-foreground: <hex>;
  --color-primary: <hex>;
  --color-accent: <hex>;
  --color-destructive: <hex>;

  /* From state.color.derived */
  --color-muted: <hex>;
  --color-muted-foreground: <hex>;
  --color-border: <hex>;
  --color-input: <hex>;
  --color-ring: <hex>;

  /* From state.type */
  --font-display: "<font>", system-ui, sans-serif;
  --font-body: "<font>", system-ui, sans-serif;
  --font-mono: "<mono-font>", ui-monospace, monospace;

  /* From state.depth.radius_scale */
  --radius-sm: <Npx>;
  --radius-base: <Npx>;
  --radius-md: <Npx>;
  --radius-lg: <Npx>;
}
```

Now every Tailwind utility uses your tokens: `bg-primary`, `text-foreground`, `border-border`, `font-display`, `rounded-base`, etc.

## Gotchas

- **Bun 1.2.3+ required** for the `routes` field in `Bun.serve` and the API endpoint object syntax. Older Bun forces you back to `fetch(req)` switch statements.
- **`bun-plugin-tailwind` is a NATIVE plugin** — not the same as a generic PostCSS plugin. It runs inside Bun's bundler pipeline, not as a preprocessor.
- **Tailwind v4 + CSS Modules** — works, but `@apply` inside CSS Modules has quirks. Prefer utility classes directly in JSX.
- **HMR scope** — `bun --hot` reloads server-side modules; Bun.serve with `development: true` reloads client-side bundles. Both together = full HMR.
- **`createBrowserRouter` does NOT need a `<BrowserRouter>` wrapper.** `RouterProvider` is the wrapper. Mixing crashes silently.
- **No `tailwind.config.js` in v4.** If you see one in an old tutorial, ignore it. Theme goes in CSS.
- **Bun cannot bundle Vite plugins.** If Architecture A starts pulling in a Vite plugin, you've drifted — switch to Architecture B intentionally.
- **`<link rel="stylesheet" href="tailwindcss" />`** is a string literal, not a path. The plugin resolves it. Do not write `./tailwindcss` or `node_modules/tailwindcss`.

## Final emit contract (extending SKILL.md STEP 9)

When emitting code, the Design rationale section in the response should ALSO include a 1-line stack note:
```
Stack: Bun + React Router v7 (Data Mode) + Tailwind v4 via bun-plugin-tailwind.
```
OR
```
Stack: Vite + React Router v7 (Framework Mode, SSR) + Tailwind v4 via @tailwindcss/vite.
```

This tells the user which architecture was chosen and why. If they wanted the other, they'll say so.
