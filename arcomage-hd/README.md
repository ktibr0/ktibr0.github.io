# ArcoMage HD on GameCenter

This folder contains an adapted copy of the saved ArcoMage HD 2.0.3 distribution for the `/arcomage-hd/` path on GitHub Pages. Rules are unchanged; changes are limited to URL adaptation and audio startup guards.

## Provenance

- Upstream project: <https://github.com/arcomage/arcomage-hd>
- Saved GameCenter source commit: `9fbe12197e53734b43a5917c598e6aaf043beafa`
- The bundled application reports version `2.0.3`. Upstream tag `v2.0.3` resolves to commit `efa3ea4120ce2aef4625c50d492a733cf3afbbf7` (tag object `604587133cc61c6af0f88314ad42bad930d070df`), but this saved distribution has **not** been verified as an exact build from that tag.
- `dist/` is the preserved, unmodified input snapshot. Run `node tools/arcomage-adapt.cjs` from the repository root to reproducibly write the adapted output beside it. The adapter refuses a changed input snapshot; hashes are recorded in `build-manifest.json`.
- Git stores normalized text blobs with LF. `.gitattributes` checks out source distribution text as CRLF on every platform so the adapter's raw-byte input hash stays stable; generated worker, registration script, credits, manifest, and this README use LF. Binary assets remain byte-preserved. Do not renormalize `dist/`.
- `build-manifest.json` records both each output's raw worktree `sha256` and `publishedSha256`, which hashes the LF-normalized bytes for Git text extensions and the unchanged raw bytes for binary assets. Use `publishedSha256` to compare files served by GitHub Pages.
- `CREDIT.md` is expected alongside this file and should be retained with the upstream author/source credits.

## Licensing

The upstream application code is distributed under MIT as documented by the upstream project. `LICENSES.txt` and `CREDIT.md` preserve the upstream notices and credits. `CREDIT.md` states that the original 3DO game assets remain copyrighted and explains the upstream project's fair-use position; that position is the upstream author's statement. The MIT code license does not relicense those media. See `CREDIT.md` for attribution and the full rights notice.

## Hosting behavior

The adapted entry point and assets use `/arcomage-hd/`. The service worker is registered at `/arcomage-hd/sw.js`, has scope `/arcomage-hd/`, and uses a content-derived cache name. It caches the local distribution and only handles same-origin requests within that path. The production host should redirect `/arcomage-hd` to `/arcomage-hd/`.

Single-player assets are local. Multiplayer may contact external WebRTC signaling/STUN services; it is outside the offline single-player hosting guarantee. External author, source, and help links remain links and are not required to load the local game.

If Web Audio is unavailable or cannot be initialized, the game runs without sound. Windows headless WebKit does not provide Web Audio in the current acceptance environment; native audio on physical Safari/iPad must be checked separately. When Web Audio is available, the upstream audio loading and playback path is preserved.
