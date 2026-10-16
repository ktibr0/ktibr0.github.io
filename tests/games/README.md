# Sumplete / RSVP acceptance

Scenarios are authored by the supervising agent, executed by a separate `gpt-6-luna` with reasoning `low`, and reviewed by the supervisor. Implementer uses `gpt-6-luna` medium. Tests must not be weakened by the implementer or runner.

From Git root:

```text
node tests/sumplete/rules.cjs
node tests/games/acceptance.cjs
node tests/cryptographer/rules.cjs
node tests/cryptographer/acceptance.cjs
```

`tests/sumplete/structural.cjs` verifies historical extraction commit `cc3524f` only: run it on that version, before replacing the legacy application. Its exact-match expectations intentionally stop matching the later corrected game.

The browser runner starts a local HTTP server and launches Chromium and WebKit. Runtime configuration follows `tests/cryptographer/README.md`: `PLAYWRIGHT_MODULE_ROOT`, `PLAYWRIGHT_CHROMIUM_EXECUTABLE`, `PLAYWRIGHT_WEBKIT_EXECUTABLE`, `TEST_ENGINES`. Optional `TEST_FILTER` selects scenario names (for example `RSVP`); `TEST_BASE_URL` targets the published origin. Local evidence is retained in `_work/sumplete-rsvp/`. Test-only storage seeding preserves subsequent reloads. RSVP real session interactions and screenshots require supervisor inspection in addition to automated metadata/layout checks.

Network sandbox errors accessing localhost are environment failures; retry the same narrowly scoped runner with the system PowerShell and required escalation per AGENTS. Do not change application behavior to accommodate a denied local network.

Geometry assertions do not replace screenshot review. Browser engines do not certify physical iPad/Android behavior.

After a successful Pages deployment, run `node tests/games/published.cjs` for HTTP/content equality of the eight game files. Run the browser suite with `TEST_BASE_URL=https://ktibr0.github.io` and `TEST_FILTER=real cycle|Sumplete sizes3.*1024x768|RSVP real guest seating|RSVP real runtime` for the eight public smoke scenarios. RSVP seating uses click/release at the source, then click/release at the chair, with frame dwell; dragging while holding is not its input contract.
