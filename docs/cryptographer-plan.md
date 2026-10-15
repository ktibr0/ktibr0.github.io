# Cryptographer improvement plan

Scope: cryptographer only. Preserve one-cell guessing, matching numeric codes, three lives, existing warm visual style, three difficulty levels, and dimming letters absent from the phrase. No profiles, competition, backend, framework, or offline service worker in this release.

## Release steps

1. Preserve tracked baseline in Forgejo `ktibr/gamecenter` before editing (done: 9fbe121).
2. Luna 6 medium: extract phrases into UTF-8 CSV; separate browser data loading, rules and presentation; implement the scoped fixes below.
3. Parent agent: author executable acceptance tests independently of implementation. Luna 6 medium: execute tests and report raw evidence. Parent: inspect changes, interpret failures/results, request corrections as needed.
4. Inspect rendered Chromium and WebKit layouts at tablet landscape and phone portrait sizes. Browser emulation does not replace physical iPad/Android acceptance.
5. Commit focused changes, push tested update to Forgejo; update existing GitHub Pages repository only after the acceptance checks pass. Verify remote revisions and deployed files where publication is available.

## Files and behavior

- `cryptographer/index.html`: semantic accessible controls, instructions, loading/error/resume UI; preserve existing style and mechanics.
- `cryptographer/styles.css`: extracted responsive styles, large tablet controls, phone layout, visible long words, safe areas, reduced motion, normal browser zoom.
- `cryptographer/data.js`: robust CSV parser and validation (quoted commas, escaped quotes, CRLF, BOM), normalization/deduplication, fetch without stale HTTP cache.
- `cryptographer/quotes.csv`: existing phrases, stable IDs, text, author, category; deduplicate normalized text without inventing sources or changing phrase wording. Keep full original data in Git baseline.
- `cryptographer/game.js` and/or `app.js`: isolated rules and UI; disabled absent-letter keys plus handler guards, meaningful easy/medium/hard pre-reveal selection, no-repeat deck, selected-cell hints, persistence in localStorage, graceful storage failure, animation/new-game cancellation, consistent completed state.
- `cryptographer/README.md`: CSV format and editing with spreadsheets, GitHub Pages update instructions, persistence boundaries and testing commands.
- `tests/cryptographer/*`: parent-authored tests and browser checks. Keep evidence under `_work/cryptographer/` locally; do not publish browser dependencies or runtime secrets.

## Acceptance contract (owned by parent agent)

A. CSV loads all valid unique phrases, preserves Unicode and punctuation, stable IDs survive appends/reordering; malformed or empty data gives useful error and retry.
B. Missing letters remain dimmed and cannot cost a life via click or direct handler. Present wrong letters cost exactly one life; correct answer reveals exactly one cell; same letters share code, different letters never share a code.
C. Hint opens selected closed cell, decrements once, supports win; three lives and difficulty hint counts 5/3/2 preserved. Easy starts with highest-frequency letters; hard omits common letters when feasible. All phrase/level combinations have playable closed cells.
D. No repeats before deck exhaustion; refresh preserves remaining deck. Updated CSV is used for new games; an unfinished saved phrase remains recoverable if its CSV row changes/removes.
E. Reload restores phrase, cipher, revealed cells, selected cell, hints, lives, difficulty. Corrupt/unavailable/quota-limited storage cannot break play. Explicit new game discards old session only when a new puzzle begins. Win/loss are stable after reload.
F. Fast/repeated input, hint during animation, and a new game during pending animation cannot mutate the wrong game, take extra hints, or show stale win/loss overlays.
G. Chromium + WebKit: 1024x768, 1180x820 landscape, 412x915, 360x800 portrait. No page horizontal overflow or clipped long words; keyboard and selected cell reachable; resume, error and end dialogs operable at reduced heights and zoom. Real production HTML/CSV/JS/CSS load without backend/build.
H. Git diff limited to cryptographer, docs and tests; unrelated ZIP and games untouched; secret scan and remote verification before publication.
