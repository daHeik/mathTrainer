# Agent Guide

## Project overview

`mathServer` is a small, dependency-free German-language PWA for children to
practice multiplication tables with spaced repetition. It has no backend,
database, build step, package manager, or external runtime dependencies.
Progress and settings are stored locally in the browser.

The application is intentionally simple to deploy on a Raspberry Pi or any
static web server.

## Repository layout

- `index.html` contains the application markup.
- `styles.css` contains the shared application styling.
- `app.js` contains the trainer and reward-game logic.
- `flappy.html` and `tower.html` are lightweight direct-play launchers that
  open the corresponding shared implementation in `index.html` demo mode.
- `sw.js` provides network-first caching and offline fallback.
- `manifest.json` contains the PWA metadata.
- `icon-192.png` and `icon-512.png` are the installable-app icons.
- `README.md` documents features, local serving, and Raspberry Pi deployment.

## Running locally

Serve the repository over HTTP so that the service worker can run:

```sh
python3 -m http.server 8080
```

Open `http://localhost:8080/index.html`. Opening `index.html` directly with a
`file://` URL is useful for basic UI checks, but does not exercise the service
worker.

There is currently no automated test or lint command. Do not introduce a
toolchain just for a small change unless the task specifically requires it.

## Implementation conventions

- Keep the app dependency-free and usable as static files.
- Preserve the existing ES5-compatible JavaScript style: `var`, function
  declarations/expressions, semicolons, and single quotes in JavaScript.
  Existing uses of `Set`, `Array.from`, and other current browser APIs are
  acceptable.
- Keep all user-facing copy in German and use the existing friendly,
  child-oriented tone.
- Prefer DOM APIs and `textContent` for dynamic user data. Only use
  `innerHTML` for content assembled entirely from trusted application values.
- Maintain the responsive, touch-first layout, iOS safe-area handling, and
  accessibility behavior. In particular, do not disable pinch zoom.
- Keep controls usable on both touch devices and desktop browsers.
- Facts are stored canonically with `a <= b`; display order may be randomized.
  Preserve this invariant when changing question or progress logic.
- Focused table rounds persist their selected row in `today.focusTable`. Their
  available row buttons come from `enabledTables`, while the other factor spans
  the complete configured `min` to `max` range even when that factor is not in
  `enabledTables`. Display the focused row as the multiplication factor or
  division divisor. Focused rounds prioritize due reviews, then use distinct
  row members to fill available slots; `newFactsPerRound` only limits mixed
  rounds.
- The new-fact limit applies independently to every round. The legacy
  `newFactsPerDay` config value is retained only as a backup-compatibility
  mirror of `newFactsPerRound`.
- Multiplication queue keys use the canonical fact key (for example `3x8`).
  Division queue keys prefix the same family with `d:` (for example `d:3x8`).
  Division progress is stored in the fact's nested `division` record and is
  unlocked permanently when multiplication reaches box 4.
- When division is enabled and eligible division facts exist, each newly built
  round reserves one division slot so the setting has an immediate visible
  effect.
- Keep markup, styling, and behavior in their existing files; avoid unrelated
  formatting or large-scale reorganization.

## Persistence and compatibility

The current root data is stored under `km_1x1_trainer_v2`. The old
`km_1x1_trainer_v1` single-profile data is retained as a migration source.

When changing persisted data:

- Preserve existing progress, profiles, settings, streaks, stickers, and
  badges.
- Add safe defaults in `normalizeProfile()` for new profile fields.
- If the root structure changes incompatibly, add an explicit migration and
  version/key strategy instead of silently discarding old data.
- Keep backup export/import compatible where practical, and validate imported
  data before replacing the current state.
- Remember that settings changes rebuild the current daily queue.

The parental PIN is a local UI guard, not a security boundary. Do not describe
browser-local data or the PIN as secure storage.

## Offline behavior

`sw.js` uses a network-first strategy and falls back to cached assets or
`index.html`. When changing deployable assets or caching behavior:

- Keep the `ASSETS` list synchronized with files required offline.
- Bump `CACHE_NAME` when a release needs to invalidate previously cached
  content.
- While changes are still uncommitted, keep `CACHE_NAME` exactly one version
  above the value in `HEAD`. Do not increment it again for every additional
  edit that will be part of the same commit.
- Verify both an online load and a reload while offline.
- Keep service-worker registration guarded so direct `file://` use does not
  fail.

## Validation checklist

For every change, perform the checks relevant to the affected behavior:

1. Serve the repository locally and load it with browser developer tools open.
2. Confirm there are no console errors and no failed required asset requests.
3. Exercise a normal daily round, a wrong answer and its requeued question,
   and a bonus round when learning logic changes.
4. Check both multiple-choice and keypad modes, plus gap tasks when question
   rendering changes.
5. Check profile switching, parental PIN access, settings, and reload
   persistence when state handling changes. The default PIN is `6969`.
6. Test backup export/import before changing its schema or validation.
7. Check a narrow mobile viewport and a desktop viewport for UI changes.
8. For PWA changes, verify installation metadata and offline reload behavior.

Use a fresh browser profile or clear only this app's site data when a clean
state is needed. Do not erase a user's real browser data during testing.

## Documentation and commits

- Update `README.md` when user-visible features, deployment steps, or required
  files change.
- Keep commits focused and use concise imperative commit subjects, matching the
  existing history.
- Do not commit exported progress backups, local server logs, or editor files.
