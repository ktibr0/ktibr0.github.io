# Cryptographer acceptance checks

The supervising agent authored the test scenarios; Luna 6 medium implements the game and separately executes the tests. The supervisor reviews results, code and screenshots before publication.

From the repository root:

```text
node tests/cryptographer/rules.cjs
node tests/cryptographer/acceptance.cjs
```

The first script uses Node built-ins and verifies the CSV migration against baseline Git commit `9fbe121`, CSV parsing, all 710 phrases across three difficulties, rules, and save validation. It requires that baseline commit in the local Git history.

The browser script requires Playwright, creates a temporary localhost static server, runs Chromium and WebKit, and closes the server/browsers afterward. A normal Playwright installation works without custom paths. Optional environment variables: `PLAYWRIGHT_MODULE_ROOT`, `PLAYWRIGHT_CHROMIUM_EXECUTABLE`, `PLAYWRIGHT_WEBKIT_EXECUTABLE`, and `TEST_ENGINES=chromium,webkit`.

Results and screenshots are retained locally under `_work/cryptographer/` (ignored by Git). The browser suite includes real UI actions and handler-level race cases, unavailable/corrupt storage, CSV failure/retry and updates, saved phrase recovery, no-repeat selection, hidden-answer checks, and five viewport sizes in each engine. Fixtures override only the CSV request; the actual application HTML/CSS/JS is served unchanged.

Screenshots must be reviewed manually. Numeric and DOM checks alone previously missed a WebKit 3D backface rendering defect; the final implementation uses explicit face visibility and never inserts unrevealed letters into card elements.

Browser engines and viewports do not certify a physical iPad or Android device. Manual acceptance should include screen rotation, browser zoom, Safari browser bars, and resuming on the actual device.
