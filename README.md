# MoodTune

**Your mood. Your music.**

The MoodTune music player is installed in
`src/App.jsx`, including the mood quiz, recommendations, search, favorites,
and audio controls.

## Brand

The MoodTune mark combines an M-shaped mood face, a smile, and a musical note
in a violet-to-pink gradient. The same scalable asset, `public/moodtune.svg`,
appears in the header, vinyl illustration, and browser favicon.
The project folder is `moodtune`.

Online search, artwork, and song previews require an internet connection and
use the iTunes Search API (India storefront). Previews are short clips, not full songs.

## Live discovery

- Mood, listening intent, and language selections fetch a new pool of preview-ready
  songs rather than reordering the fixed sample catalog. Language filter pills also
  fetch new results. "Find a fresh mix" rotates search terms for more discovery;
  the provider may return overlapping songs. Results blend both queries, remove
  duplicate recordings, and prioritize artist variety.
- These are search-based discovery results, **not trending charts**. Mood and language
  are search hints, not verified song metadata. BPM and energy are not fabricated.
- Loading, empty, timeout, and service-error states are shown explicitly. Failed
  discovery does not silently substitute the old static playlist or demo audio.
- Likes and early skips adjust the current mix. Saved track details remain available
  for the current session, even after switching mixes. An already playing track
  continues when preferences change; choose a new track to change playback.
- Search has debounced live results, preview-ready tracks, retry, recent selections
  saved on this device, keyboard focus containment, and Escape-to-close.
- Search history keeps the last 10 unique terms in this browser's local storage,
  newest first. A term is saved when you press Enter, select/preview a result, or
  close search (including Escape and clicking outside), rather than saving every
  keystroke. History survives reloads, is not synced across devices, and can be
  removed using "Clear history". Storage errors are shown explicitly.
- A floating search bar stays within reach while scrolling, above the mini-player
  or inside the full-player view. On mobile, search opens as a bottom sheet.
  Each opening starts with an empty search field and no stale results; recent
  selections remain available as optional shortcuts. The header and mood card
  avoid duplicate search buttons. The mobile mood card uses concise copy,
  side-by-side playback/settings controls, and a compact spotlight row.
- Each result has a separate left Play/Pause button to preview without leaving
  search. Tapping the artwork, title, or rest of the result opens the full player
  and starts (or resumes) that song, rather than toggling it off.
- Selecting a search result starts song radio: artist and genre searches blended
  with the current mood/language preference. The displayed queue, Next, Previous,
  shuffle, and autoplay use that same pool; mood changes refresh it without
  interrupting the current preview. Related-song loading, empty, and failure
  states are explicit. Similarity is heuristic, not verified audio analysis.

Run the discovery helper tests with `node --test src/musicDiscovery.test.js`
(or prefix with `npm exec --yes --package=node@22 --` on older Node).
Run history tests with `node --test src/searchHistory.test.js`.

## Run locally

Use Node.js 22.13+ (Node 22 LTS recommended) with the current Vite and ESLint dependencies.
Tailwind CSS 3, PostCSS, Autoprefixer, and Lucide icons are configured.

```bash
cd /Users/vpatoliya/Documents/GitHub/moodtune
npm install
npm run dev
```

Open the localhost URL printed by Vite (normally http://localhost:5173).

If your installed Node is older, use a temporary compatible runtime:

```bash
npm exec --yes --package=node@22 -- npm install
npm exec --yes --package=node@22 -- npm run dev
```

Run `npm run build` for a production build and `npm run lint` for lint checks,
using the same temporary-runtime prefix if needed.

## Deploy to Vercel

The root `vercel.json` configures this app as a static Vite deployment.
`package.json` selects Node.js 22.x for the build.

1. Push the project, including `package-lock.json` and `vercel.json`, to GitHub.
2. In Vercel, select **Add New > Project** and import the repository.
3. Use these settings:

   | Setting | Value |
   | --- | --- |
   | Framework Preset | Vite |
   | Root Directory | Repository root (`./`) |
   | Node.js Version | 22.x |
   | Install Command | `npm ci` |
   | Build Command | `npm run build` |
   | Output Directory | `dist` |
   | Environment Variables | None required |

4. Select **Deploy**. Future pushes to the configured production branch trigger
   production deployments; pull requests receive preview deployments.

The app uses in-page state rather than URL routes, so no SPA rewrite is needed.
The iTunes API, artwork, and previews are accessed directly from the browser;
deployment does not proxy them or resolve provider/browser playback failures.
After deployment, check the quiz, discovery, search, and preview playback in
Chrome or Safari on the deployed HTTPS URL.

## React + Vite template

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
