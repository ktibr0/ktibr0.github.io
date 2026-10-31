# ArcoMage self-hosting acceptance

Supervising agent authors/reviews the scenarios. A separate Luna 6 low runs them without changing assertions. Implementation belongs to Luna 6 medium. Evidence stays in `_work/arcomage/`.

From the repository root:

```text
node tests/arcomage/static.cjs
node tests/arcomage/acceptance.cjs
node tests/arcomage/navigation.cjs
node tests/arcomage/published.cjs
```

`static.cjs` needs only Node. It verifies the preserved input, every output hash, an exact allowlist of URL changes and audio startup guards, metadata/manifest scope, notices and generated worker lifecycle/isolation.

`acceptance.cjs` uses Playwright with Chromium and WebKit, launches its own local static server, blocks every external host, then uses actual UI controls for language, mute, settings, AI game and touch play. Discard exercises the documented 500 ms long-press handler using DOM touchstart/touchend events in both engines; it does not certify a physical device gesture. It covers reload/settings persistence, five viewport sizes, screenshots, foreign cache/storage preservation, neighboring games, worker update and reopening the game after actually shutting down its HTTP origin. A fresh unrequested language is loaded from cache offline. No global AudioContext shim is installed: Chromium uses native sound sources (their `start()` is observed), Windows WebKit exercises the application's no-audio fallback because that test runtime lacks Web Audio. Audibility and real iPad/Android are separate device checks. Portrait preserves upstream's request to rotate; this is not a portrait redesign.

Variables: `TEST_ENGINES=chromium,webkit`, `PLAYWRIGHT_MODULE_ROOT` (directory containing playwright), `PLAYWRIGHT_CHROMIUM_EXECUTABLE`, `PLAYWRIGHT_WEBKIT_EXECUTABLE`, `ARCOMAGE_RUN_ID` for a new evidence directory. Default paths follow this workspace's documented Windows environment.

Set `ARCOMAGE_BASE_URL=https://ktibr0.github.io` to run the public browser scenarios; public runs do not modify the host worker or shut down the origin. `published.cjs` compares all accepted distribution files, records byte-identical matches and permits only CRLF/LF normalization for text against its separate canonical SHA. Binary files must match exactly. It also checks both catalog links. Public Windows WebKit setOffline emulation is an explicit SKIP due to [Playwright #42775](https://github.com/microsoft/playwright/issues/42775), also reproduced in this release. The local acceptance with a genuinely stopped origin remains mandatory and provides the stronger offline result.

`navigation.cjs` clicks ArcoMage from both catalogs in both engines and requires the local game to open in the same tab. It supports the same browser-path variables and `ARCOMAGE_BASE_URL` for the public check.

Screenshots must be reviewed by the supervising agent. Initial failing runs are retained. A selected card moves through several negative position slots or is removed when discarded; the test tracks that specific DOM node rather than assuming one fixed CSS position.

The foreign-cache fixture keeps a separate owner tab open. Independent probes without the game showed Windows WebKit loses cache entries when the creating document navigates away; keeping that document alive preserves them across other tabs' navigations. The application must still preserve the actual sentinel contents. Worker updates use Node-side polling of asynchronous lifecycle/cache conditions; waiting for a Promise-valued browser predicate was observed to return before installation completed. Smoke settings use ample towers/walls and high victory thresholds so random cards do not end the game before both actions are exercised; the game rules and AI are not mocked.
