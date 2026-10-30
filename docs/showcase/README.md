# Recorded showcase — Orbitscar

This is a real local browser recording operated by an AI assistant through Playwright keyboard, pointer and form inputs. No replacement artwork or generated gameplay was used. The README embeds a three-second reduced-resolution GIF excerpt and links the complete silent H.264 recording. The video is re-encoded at 20 fps and 960 pixels wide, with no speed-up, frame reordering or fabricated interaction.

## Provenance

- Application revision: [`3f1bf3fef60f961d192ad42b92c142d08715850e`](https://github.com/gthgomez/Orbitscar/commit/3f1bf3fef60f961d192ad42b92c142d08715850e). Only documentation, capture scripts and media are added after that revision.
- Captured: 2026-10-30T12:09:51.007Z on Linux, Chromium 154.0.8037.57, viewport 1280 × 800.
- Evidence class: **DEVELOPER_REVIEWER** (AI-operated capture with source knowledge). This is not a blind playtest, human validation or an in-game AI provider execution.
- Fixture: Fresh solo local save; Cinder Yard opening sortie; Phaser Canvas fallback (--disable-webgl); no authority profile, save injection or debug progression.
- [Machine-readable observed capture record](capture.json); [exact input script](../../scripts/capture-showcase.mjs); [encoding script](../../scripts/encode-showcase.sh).
- Eligibility: GitHub API `repos/gthgomez/Orbitscar` reported `fork: false` and no parent on 2026-10-30. Initial history, project documentation and owner copyright were inspected; no external upstream clone was identified. This is an engineering provenance check, not legal clearance.

## Reproduce

Use the committed lockfile and the README's supported Node version. Install Chromium and FFmpeg on the host, or set `CHROMIUM_PATH` to an existing Chromium executable. These shell commands use the same local ports and browser-video cache layout as the recorded run. `SHOWCASE_URL` may override the frontend URL. Run against local development instances only; the scripts create local game state.

```bash
pnpm install --frozen-lockfile
pnpm build:web
pnpm --filter @orbitscar/web exec vite preview --host 127.0.0.1 --port 4182 --strictPort
# In a second terminal:
export PLAYWRIGHT_BROWSERS_PATH=../.browsers
pnpm exec playwright install ffmpeg
CHROMIUM_PATH=/usr/bin/chromium node scripts/capture-showcase.mjs
bash scripts/encode-showcase.sh
```

A new browser context creates a fresh save/guest every run. Gameplay timings, guest IDs, particles and the browser's rendering can vary; the observed revision and assertions are stored by the capture script. Raw WebM recordings remain ignored and local. Run the encoding script only after a successful capture; it overwrites the derived GIF and MP4.

## What the capture verifies

- home rendered.
- defense placed through canvas.
- three Line Riggers trained.
- target scouted.
- army composed.
- live battle resolved.
- report opened.

## Verification and limits

`pnpm check` passed: all three type checks, content validation, 118 tests and production web build. Vite reports the existing large-bundle warning. Capture assertions passed with zero browser page errors. This documentation change does not close the human playtest gate.

This is the browser solo mode with fresh local storage, not the separate loopback authority or a multiplayer demo. The project remains local-only and unpublished; the authority stays bound to loopback and BLOCKED_ON_HUMAN_PLAYTEST remains unchanged. Phaser.AUTO uses the supported Canvas fallback with Chromium `--disable-webgl` because this cloud machine’s software WebGL produced black sprite textures. The screenshot labeled renderer is read directly from the real canvas; the MP4 and other screenshots retain the normal UI. No save injection, clock jump, granted progression or altered game code is used. This is a developer capture, not an isolated blind test or a human session.

## Media and rights

The images show this repository's own rendered project at the recorded revision. The pre-existing [proprietary license](../../LICENSE), credits and asset notices remain authoritative; this showcase grants no reuse rights and does not republish private source artwork. Screenshot captions describe only what is actually shown. Full-size PNGs are retained for readable labels; the looping GIF is a brief preview, not the whole session.

Orbitscar’s independent recovery and implementation boundary remain documented in the [recovery manifest](../RECOVERY_MANIFEST.md) and [recovery history](../history/recovery/README.md).
