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

- "Made for Your Mood" uses curated song/language/mood metadata rather than treating
  broad mood words as verified song attributes. "Match my mood" follows the selected
  mood; uplift, relax, energy, and reflection goals select happy, calm, motivated,
  and reflective picks respectively, overriding a conflicting starting mood.
  Language pills restrict the curated pool; Surprise balances across languages.
  An expanded catalog supplies at least twelve distinct candidates for every
  mood/goal/language combination. Up to 18 seeds are checked by title and artist
  so unavailable recordings do not immediately shrink the six-song shelf.
  Unrelated songs, alternate versions, covers, and recordings without previews are
  excluded. Each visit starts at a randomized catalog position. "Find a fresh mix"
  prioritizes unseen titles for the current preferences, then least-recently-shown
  titles when the pool runs out. Likes do not pin previously shown songs above new
  choices. The same freshness rule applies to artist suggestions. Recently shown
  titles are remembered for this page session, separately for each mood/goal/language.
  Small pools and storefront availability can still require some overlap.
  Successful searches are cached in memory for ten minutes (up to 150 queries).
  Partial API failures retain available previews with a visible warning and retry;
  total failures show the discovery error state.
- "You Might Also Like" independently searches up to three artists from the resolved
  mood mix, rather than using leftovers from the six-song shelf. It excludes the
  mood mix's recordings and deduplicates alternate releases. These suggestions
  are metadata-related, not verified mood or language matches. Refresh, loading,
  empty, and retry states are provided; this does not change current-song autoplay.
- Mood fit is subjective human curation, **not audio analysis or a trending chart**.
  Language/style labels come from the curated catalog, not arbitrary API results.
  Coverage is intentionally limited: fewer matching previews are better than
  unrelated fillers. No BPM or energy measurements are fabricated.
- All three "Find my sound" steps use mood-colored flowing aurora cards, inspired
  by [React Bits Aurora](https://reactbits.dev/backgrounds/aurora). This is an
  original lightweight CSS adaptation, not the React Bits WebGL component.
  Decorative gradients animate behind crisp text, with selected states and keyboard
  focus outlines. Reduced-motion preferences disable the animation. No external
  images, canvas contexts, or animation dependencies are required; the original
  landing hero is unchanged.
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
- Returning visitors with saved history see "A little more your style" below the
  original landing hero, in a compact horizontally scrollable song shelf rather
  than a large introductory panel. It blends preview-ready results from the three most recent
  searches, deduplicates songs, and shows the search behind each suggestion.
  Refresh rotates picks within newly fetched search pools; overlap is possible.
  Preview buttons keep the landing page open; song rows open the player with
  song radio. Clearing history removes the section and cancels pending requests.
  New visitors retain the normal landing page. These are search-based suggestions,
  not an AI taste profile; loading, empty, timeout, and error states are explicit.
- A floating search bar stays within reach while scrolling, above the mini-player
  or inside the full-player view. On mobile, search opens as a bottom sheet.
  The sheet resizes for the on-screen keyboard and results scroll independently;
  a soft frosted layer blurs the page behind the search bar and mini-player.
  Each opening starts with an empty search field and no stale results; recent
  selections remain available as optional shortcuts. The header and mood card
  avoid duplicate search buttons. The mobile mood card uses concise copy,
  side-by-side playback/settings controls, and a compact spotlight row.
- On phones (under 640px), the post-quiz home screen uses swipeable rails like a
  music-app home: Quick Mood Shift (placed just before You Might Also Like, after
  the songs), listening goals and language chips are single
  scrollable rows; Made for Your Mood and "Because you liked" scroll sideways in
  columns of three songs; You Might Also Like is a row of cover cards. Long helper
  copy is hidden on mobile. Tablet and desktop layouts are unchanged.
- The browser/phone Back button follows in-app navigation: it steps back through
  quiz steps and screens, and closes the search sheet, full player, or Change Mood
  panel before leaving the site. Closing an overlay with its X uses the same history
  entry, and opening the player from search replaces the search entry so Back does
  not reopen search. Navigation is kept in memory; the URL does not change.
- Each result has a separate left Play/Pause button to preview without leaving
  search. Tapping the artwork, title, or rest of the result opens the full player
  and starts (or resumes) that song, rather than toggling it off.
- Selecting a song from any surface starts song radio that aims for 15–20
  upcoming previews, filled in priority order: closest matches to the playing
  song first, then other songs by its artists, then songs in its genre, then the
  current mood mix, and finally recent-search results that share the genre or an
  artist. Explicit styles such as Garba/Dandiya, Bhajan, Qawwali, Ghazal, and
  Lo-fi are matched from title/album/genre text and are filled only with more of
  the same style (extra style searches), never with mood filler. Each queued song
  carries the reason it was added. Style matching cannot identify songs whose
  metadata gives no indication of their style; it is not audio analysis.
- The queue is rebuilt around each new playing song. Next, shuffle, and autoplay
  follow that pool, excluding already played songs in the current radio session.
  Previous uses actual playback history. Selecting a new song manually starts a
  new radio session. Loading, partial-failure, timeout, and failure states are
  explicit; if fewer than 15 related previews exist, the queue says so.
  Mood changes still update the separate mood-discovery section.
- Volume: a simple Volume card sits at the end of the full player, after Why
  This Song and the autoplay queue, with a mute button, a slim mood-coloured
  slider, a full-volume button and the percentage; the desktop mini player shows a speaker icon that expands into a
  slider on hover/focus. The level and mute state are saved in localStorage, and the
  slider uses a perceptual (squared) curve. Dragging to 0 mutes; unmuting restores
  the last audible level. Keyboard shortcuts (outside text fields): `M` toggles mute,
  `[` / `]` change volume by 5%. iOS Safari ignores in-page volume, so there the
  slider is hidden and you use the device buttons; mute still works.

Run the discovery helper tests with `node --test src/musicDiscovery.test.js`
(or prefix with `npm exec --yes --package=node@22 --` on older Node).
Run history tests with `node --test src/searchHistory.test.js` and volume tests
with `node --test src/volume.test.js`.

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
