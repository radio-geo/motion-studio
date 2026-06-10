# Motion Studio

Free, self-hosted, browser-side motion graphics for editors and journalists.
No render API, no server cost. Renders in the browser via canvas + MediaRecorder.

## Run locally
It is pure static HTML/CSS/JS. Serve the folder (needed for font + module loading):

```
npx serve .
# or
python -m http.server 8080
```

Open the URL, sign in with **user / 123**.

## Architecture
- `js/engine/text-targeting.js` — pick a phrase, animated underline, zoom focus (shared by Quote + Social)
- `js/engine/brand-kit.js` — one Droeba kit drives every template (logo, fonts, palette, lower-third)
- `js/engine/pipeline.js` — preview (rAF) -> render (captureStream + MediaRecorder, WebM live) -> export. MP4 via ffmpeg.wasm seam.
- `js/engine/timeline.js` — easing helpers
- `js/templates/quote.js` — Template 1, fully animated
- `js/templates/social.js` — Template 2, Facebook skin (stub, next)
- `js/templates/slideshow.js` — Template 3, Ken Burns (stub, last)

Templates expose one `drawFrame(ctx, t)`, so the preview and the export are identical.

## Auth
- Live: hardcoded `user` / `123` (`js/auth.js`)
- Dormant seams: Supabase email + Google OAuth

## Coming later (switches, not rewrites — see `js/config/placeholders.js`)
4K export, ProRes 4444 / alpha .mov, server-side render, AI icon generation,
connector asset library + Drive delivery. All labeled and greyed in the UI.

## Fonts
Georgian faces live in `/fonts`. Quote display font: `archyedt-bold` (ArchyEdit).
Mtavruli faces available for lower-thirds. Swap the Droeba font once the brand sheet lands.

## Deploy
Static host (Vercel / Cloudflare Pages). For the MP4 (ffmpeg.wasm) path, set
COOP/COEP headers so SharedArrayBuffer is available.
