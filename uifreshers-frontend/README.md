# uifreshers. — Frontend (Phase 0 + Landing + Auth)

React + Vite frontend for the UI Freshers Companion rebuild. This is the first slice:
project scaffold, the ported design system (your purple/magenta/gold palette + LearnHub's
pill-button/card-lift patterns), the merged landing page (Figma's hero/stats/guides/carousel/FAQ
blocks), and the auth screens wired to your FastAPI backend.

## Setup

```bash
npm install
cp .env.example .env
# edit .env: point VITE_API_BASE_URL at your running backend,
# and set VITE_GOOGLE_CLIENT_ID to the same Client ID used in the backend's .env
npm run dev
```

Run the backend alongside it (see the backend's own README) — the frontend expects it at
`http://localhost:8000/api` by default.

## What's built

- **Design system** (`src/assets/scss/`) — color tokens from your brand spec, pill buttons,
  card-lift hover, icon-shape utility, badges. No Bootstrap JS dependency; all interactivity
  (dropdowns, accordions, carousel) is plain React state.
- **Icons** — Lucide React throughout, no emojis.
- **Landing page** (`src/pages/Landing.jsx`) — hero with rotating feature snippets, trust
  stats band, guides preview grid, auto-sliding faculty carousel (pause/prev/next), FAQ
  accordion. Content currently uses placeholder copy matching what's on the live site/Figma —
  swap for live API data once the reference-data endpoints are wired in.
- **Auth** (`src/pages/AuthPage.jsx`) — single screen, tabs between sign-in/create-account.
  Google Identity Services button renders above the email form; Google path never shows a
  signup form, matching your spec. Talks to `/api/auth/register`, `/api/auth/login`,
  `/api/auth/google`, with automatic refresh-token rotation baked into the API client
  (`src/api/client.js`).
- **Routing** — `/` (landing, public), `/auth` (public), `/dashboard` (protected, redirects to
  `/auth` if not logged in). Catalog/Guides/Resources/Opportunities/CBT/FAQ routes are stubbed
  in `App.jsx` as comments — next slice.

## Not yet built (next phases)

- Course Catalog, Faculty Guides, Resources, Opportunities, CBT Practice, FAQ & AI pages
- Academic Identity Setup onboarding modal (wire to `/api/users/onboarding`)
- Wiring landing page content to live `/api/search`, `/api/faculties`, `/api/guides` data
  instead of placeholder arrays
- Dark/light mode toggle (present in Figma nav, not yet ported)
- PWA manifest + offline support
- Final call on AI Mentor / CBT: still routed conceptually to Telegram for now — flag when
  ready to decide in-app vs. Telegram

## Notes

- This was hand-written outside of `npm create vite` due to a sandboxed environment without
  registry access, so it hasn't been run through an actual `npm install && npm run dev` cycle
  yet. Double-check on your machine and ping me with any error output if something doesn't
  compile — happy to fix immediately.
