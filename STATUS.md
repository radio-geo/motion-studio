# Motion Studio — current status (handoff)

Last update: 2026-06-11. Live: https://motion-studio-5b2.pages.dev (V1) · https://motion-studio-5b2.pages.dev/v2/ (V2)
Repo: github.com/radio-geo/motion-studio (branch `main`). Push to `main` = Cloudflare Pages auto-deploy.
GitHub `main` is the source of truth. Pull before editing.

## V2 (new, lives in /v2, V1 untouched at root)
Fresh build. Same free-forever architecture (static, browser render), new engine:

- Renderer fix: canvas backing store = export resolution, no devicePixelRatio scaling.
  This was the bug that broke V1 on scaled displays (150%/200% laptops showed only a quarter of the frame).
- Export rebuilt: WebCodecs VideoEncoder + vendored muxers (mp4-muxer/webm-muxer, MIT).
  MP4 (H.264) and WebM render OFFLINE frame-by-frame: no dropped frames, file = preview exactly.
  No ffmpeg.wasm, no SharedArrayBuffer, no COOP/COEP needed. Fallback for old browsers: MediaRecorder WebM.
- PNG still export. Safe-area guides (action/title) on a separate overlay canvas (never in exports).
- Project save/open (.json, images embedded) + localStorage autosave draft restore.

## The 11 feedback points — V2 status
1. Title above text — DONE (kicker with accent tick, own inspector).
2. Two-stage motion (full text first, auto-scroll if long, then zoom to phrase + underline) — DONE.
3. Author placement (9-grid + nudges + size + backing, corner conflict auto-nudge + warning) — DONE.
4. Scrollable quote input — DONE (textarea max-height, panel scrolls).
5. Typewriter — FIXED (deterministic chars-over-window, works in export too).
6. Background system (solid/gradient/image + vignette/grid/dots/grain/accent overlays + Dark/Light presets that flip ink) — DONE.
7. Default duration 5 s — DONE.
8. MP4 export — FIXED via WebCodecs (see above).
9. Designed exit (underline retracts, word cascade out, author slides, vignette closes, logo leaves last) — DONE.
10. Two-panel UI (left content, right contextual inspector; click elements on canvas) — DONE.
11. Breathing ambient motion (camera, background drift, photo ring; Off/Subtle/Normal/Strong) — DONE.

Also: phrase drag-select directly on the preview (confirmed interaction), chips picker stays as fallback;
autofit type so long quotes never overflow; EN/GE i18n (201 keys, parity-checked); 16:9 + 9:16; 25/50 fps.

## V2 architecture (v2/)
- js/core/stage.js — preview renderer + overlay canvas + Pipeline facade for V1-style templates
- js/core/exporter.js — WebCodecs offline render → mp4-muxer / webm-muxer (js/vendor/)
- js/core/{timeline,i18n,auth,brandkit,textselect,project}.js
- js/templates/quote.js — flagship (hit-testing, per-element inspector, serialize/restore)
- js/templates/{social,slideshow,press}.js — ported from V1 (devicePixelRatio hack removed)
- Fonts/assets shared with root via absolute paths (/fonts, /assets).

