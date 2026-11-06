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
- `icons.svg` provides the local SVG symbol set (no external icon library).
- `app.js` contains the trainer and reward-game logic.
- `arcade-extra.js` contains the four additional Canvas games, loaded before app.js.
- `flappy.html`, `tower.html`, `gravity.html`, `brick.html`, `snake.html` and
  `snow.html`, `runner.html`, `doodle.html`, `tiles.html`, `maze.html` and
  `asteroid.html` are lightweight direct-play launchers that
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
- Arithmetic displays use `·` for multiplication and `:` for division, including
  explanations/statistics. Keep storage keys with ASCII x unchanged; the 1×1
  app name, game combo counters and close icon are not arithmetic exercises.
  renderMathText accepts both current and legacy ×/÷ notation. Avatar eyes
  accept validated six-digit hex colours, normalized to lowercase, including
  existing blue-grey #708b9a. The editor uses the native colour picker ported
  from Vocabulator `135a6c5` (UI 57).
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

Additional learning modes use `today.mode`: `hundreds`, `terms`, and `riddles`;
legacy rounds normalize to `mixed` or `table`. Hundreds skills use `h:m:` and
`h:d:` keys with separate records in `fact.hundreds`; they cover all 1..10
families, including division regardless of the mixed-round division toggle.
Term skills use `t:` keys and `profile.termSkills`; riddle skills use `r:` keys
and `profile.riddleSkills`. Include these records in reward totals and backups.
Text answers always use choices; numeric answers honor the configured input
mode and support four digits. Repeat from the completion screen preserves the
mode; the home mixed-round button starts `mixed`.
Use `setQuestionText()` for question updates and `renderMathText()` for textual
math feedback. Arithmetic expressions and operand pairs use local nowrap
`.math-expression` spans; do not insert HTML or forbid wrapping whole sentences.

`precedence` (Punkt vor Strich) uses `p:type` keys from PRECEDENCE_TYPES and
independent profile.precedenceSkills/history precedence records. Eleven active
templates, exactly two operations including those inside parentheses. Retain
all fourteen stored skill keys for progress/rewards/backups; old queued
bracketMixed/allMixed/bracketAll keys generate simpler two-operation tasks too.
No runtime eval: actual multiplication operands 1..9, exact divisions
with divisor or quotient <= 5, nonnegative integer final results <= 100.
Include both bracket and unbracketed skills in every round with >=2 questions.
Prioritize misconception answers, including 18 for 3*4+2, keep four distinct
nonnegative integer choices with a nearby distractor. Show rule and post-answer
steps; honor choice/input/adaptive, standard retries, rewards, repeat/abort,
normalization and backup. Independent of normal mixed-round number filters.

Ordinary remainder division is mode `remainder`, keys such as `rd:3x7`,
with independent `fact.remainder` learning records and
history operation `remainderDivide`. Use configured/active fact families;
exclude divisor 1. Each generated exercise independently has nonzero remainder
with probability .95, otherwise zero; always require an explicitly entered
remainder, including 0. Quotient choices/input/adaptive follow normal division;
submit both fields once through onAnswer. Preserve normal progress, reward
totals, migrations/backups, retry limits, repeat mode and abort contracts.

Written place-value division uses mode `written` and keys `w:divisor:digits`
(divisors 2..9, result digits 2 or 3). Its 16 records live in
`profile.writtenSkills`, with history operation `writtenDivide`. Include them
in reward totals and backups. Tasks have exact integer quotients and dividends
100..999. Split the quotient by decimal place, multiply each contribution by
the divisor, and omit zero contributions: use 1..3 rows according to nonzero
quotient digits, not dividend digits or total quotient length. For 848:8=106,
accept exactly 800:8=100 and 48:8=6, with no intervening 0:8=0 row.
The dedicated native-input form always starts focused at the first chunk's
left edge, validates rows in order, then enables the total at the top. Count
the whole exercise once on its final answer, not individual intermediate rows.
Every number has three separate H/T/U digit cells with `?` placeholders and
empty cells interpreted as zero, never silently right-aligned. Top and working
rows share `.written-equation` and identical grid/padding/border geometry.
Typing advances a cell; Enter skips blank zeros; the last cell validates the
row/total automatically. Backspace on an empty cell goes to the previous one.

Semi-written division is a separate mode family: `semi` (guided, 100..999),
`semiFree` (own chunks), `semiRest` (own chunks with nonzero rest).
All three stages use three-digit dividends 100..999, including the remainder;
never generate four-digit exercises. Native input fields allow three digits.
Keys `sd:mode:divisor` for divisors 2..9 (24 records) live in `semiSkills`;
history operation `semiDivide`. Include in normalization, reward totals/backups.
Intro `screen-semi-intro` explains the ordered place-value example. All stages
require a semiAllowedParts candidate: largest divisible hundreds OR largest
divisible tens amount, with units only when neither works. Guided mode prefills
semiSuggestedPart (the coarser first candidate); semiFree and semiRest may choose
either large candidate. Other chunks remain correctable
intermediate errors without updating records or progress. Never split/change the divisor. Stop splitting
when remaining < divisor, then sum and rest. Confirming that total completes
the exercise without a multiplication proof and earns one answer/reward; final wrong totals use
normal retries, intermediate errors/hints permit correction. Protect all form
callbacks with sessionRevision and answering; retain repeat/abort contracts.
Keep previous `written` records/behavior unchanged. Pedagogical references and
scope are in README; no external teaching assets were copied.

Run `node tests/learning-modes.test.js` to check generation, answer handling,
retries, reward totals, migrations, replay and completion without external
dependencies. The DOM stand-in does not replace a visual mobile/browser check.

The light app shell and seven games were ported from sibling `vocuabulator`
(MIT, source commit `22da147`, UI 28). Navigation uses Learn/Games/Statistics.
Metro Run and Halloween art were subsequently ported from source `f3e7851`
(UI 32, MIT, same copyright holder). Runner shares
the arcade lifecycle, three active minutes/three attempts, `bestRunnerScore`
normalization, first-move accounting, immersive/pause/resize and demo launch.
Runner controls: swipe/arrows/WASD/buttons; coins +20, shield up to 8s/one hit,
magnet 10s. Recovery keeps world/score. Seasonal canvas art is cosmetic only:
no hitbox changes or random calls; use active game time so pause freezes it.
Halloween worlds now use dark dusk/night palettes (no separate sun drawings),
mist and a slow distant lightning silhouette each 18s, never full-screen flashes.
Honor prefers-reduced-motion in seasonal scenery. Cleo food is `pumpkin`, drawn
by `drawSnakePumpkin`; keep bomb outlines and snow HUD legible on dark skies.
This art is a mathServer extension beyond the original Vocabulator UI 32 port.
Doodle Jump, 2048, Pac-Man and Asteroids plus colored SVG icons were ported
from Vocabulator `50f8292` (UI 35, MIT), including harder reachable Doodle
platforms and long-press control fixes. There are now twelve games.
`VocabArcade.create()` in arcade-extra.js plugs into the shared lifecycle;
keep `ARCADE_LABELS`/`ARCADE_RECORDS`, profile normalization, all screen lists,
availability, pause/resize observers, demo routing and offline assets in sync.
Records: bestDoodleScore/bestTilesScore/bestMazeScore/bestAsteroidScore.
Doodle now follows Vocabulator `6a619ac`: difficulty uses active elapsed/120,
not altitude. Widths 84..48, horizontal shifts 86..110 initially to 102..136,
rises 70..82 to 94..106. Crumb platforms stay stored but invisible
and non-solid until respawnAt (elapsed + 4 active seconds). Recovery must
choose an intact platform; pause/waiting freeze the cooldown. Offscreen
platform cleanup still applies. Other game mechanics remain unchanged.
Do not replace existing mathServer Halloween/physics changes when syncing.
Run `node tests/arcade-extra.test.js` alongside learning-modes/offline tests;
it checks 2048 merge rules, reachable Doodle routes, maze connectivity/power
and inertial Asteroid collisions. Integration tests cover all twelve rewards.
Asteroids finger-following controls synced from Vocabulator `117ea0c`
(implementation `3e37848`): `touchTarget` aims and adds thrust without replacing
velocity. Map pointer X/Y through canvas contain-letterboxing. First pointer
owns the target; release/cancel/lost capture, pause, recovery and resize clear
it. Clear pending pointers on pause so resume requires a fresh contact.
Preserve buttons/keyboard and auto-fire. Cache stays one version above HEAD.
Math learning records and storage keys stay unchanged. Games consume a play
on their first action, not selection; 2048 also starts/consumes on a field tap. All games use active simulation time with
a three-minute cap (Bricks and 2048: five minutes) and pause/hidden-view suspension.
Use `gameDurationMs(game)` in shared arcade loops, attempt checks and HUDs.
Bricks' base speed is `351 * 1.25^(level-1)`; extras multiply this base.
Higher levels cycle six layouts with breakable armor and moving rows.
Confetti belongs to math-round completion and perfect Frog Punch rounds; clear it
on leaving the view and before starting the next Frog Punch round.
Tower blocks keep immutable world Y positions (27 units per floor). Use
`towerGame.cameraY` only for rendering the whole world, including ground.
`towerSceneSpec()` defines altitude encounters: birds at 10+, aircraft at 20+,
sky-to-space blend 20..30, shuttle/station alternating every 10 floors from 30.
Animation time comes from active game time, never the wall clock. Failed
attempts continue the same tower/camera; a new game resets both.
Cleo keeps integer body cells for collisions and interpolates rendering toward
the next cell using `tick / stepDuration`. Lock direction and step duration
for each segment; apply queued input only at cell boundaries. Buffer at most
one future turn, rejecting further gestures until consumed. Render wrapped
edge copies to avoid seam jumps. Pause freezes interpolation; recovery resets it.
Snow uses `speedPercent` (100..200): +20 points per landed flip, -1 point per
full active second. Pause/waiting freeze decay; only a new game resets speed.
Base speed is a constant 286 px/s, never elapsed-time dependent. Each chaser
locks `speed` to the rider's actual speed at chase start plus 16 px/s; later
boosts/decay affect only the rider. No extra chaser-speed escalation per escape.
After at least 20 active chase seconds, fall at the next existing ravine edge
crossed by the chaser; do not create gaps or allow flips/lead to bypass the
minimum time. Keep gaps behind the camera until the chaser passes them. Award
+250 once. Clamp gap >= 0 so a pursuer cannot overtake the rider. Horizontal
catch-up alone never loses an attempt: test snowRiderPolygon against the drawn
pursuer's ground-height contour, honoring grace. Elevated jumps/grinds stay safe;
physical contact (including landing onto pursuer) takes priority. Use actual
clamped travel for the next-ravine sweep. Pause/waiting freeze chase and
1.2s fall animation; recovery clears both states. Next chase after 30 active
seconds. These states are ephemeral; rendering must not mutate gameplay.
Snow HUD: one 32px translucent row; contextual hints only when needed in a
text-width pill. Keep scenery visible; no fixed 102px full-width panel.
Actual speed is current base speed times this percentage, without a second
additive boost. Ice provides at least 150% within the same system. At >=150%
rocks break on contact. Scale jump/ramp impulses and gravity together via
`snowPhysicsScale()` to increase clearance without changing flip timing;
spawn terrain at least 2.5 seconds ahead at high speed. Show tempo in the HUD.
Snow camera targets terrain at `distance + 640` (right viewport edge), not
terrain under the rider. `updateSnowCamera()` preserves bottom clearance for
visible valleys while retaining rider visibility; scale framing with canvas height.
Successful airborne-to-ground/grind landings grant one active second of rock
smashing via `landingSmashUntil`, including collisions in the landing step.
Do not extend this window during ordinary grounded riding; reset on recovery.
New record keys and game
counts are normalized for old backups. `gamesPlayed` starts at zero on migration
with `gamesTrackedSince`; never infer historical counts from earned rewards.
General Vocabulator UI 42 sync (`6a619ac`): allowlisted `config.avatar` via
normalizeAvatar(), inline SVG customization beside the greeting, public name/
avatar editor and first-launch identity for nameless profiles (not demo mode).
Name editing no longer belongs to the PIN-protected learning settings.
Preserve identity on profile switches/backup/reset-with-config; do not touch
learning records when saving/canceling an avatar draft. Shape/appearance options
are allowlisted; garment colours additionally permit validated six-digit hex
values, never arbitrary imported SVG/HTML or CSS. Keep refined sleeves/hairstyles.
Avatar UI 43 sync from Vocabulator `93963df` / `ca8afcd`: nine top cuts and
twelve bottom cuts with independent topColor/bottomColor; migrate old blue/
coral/green/purple tops without changing saved colours or costumes. Preserve
shoulderCurls and long hair to the belly. Preview/actions stay fixed while
avatarSettings scrolls; show avatarClothesHint whenever a costume hides garments.
Shoulder hairstyle updated from Vocabulator `71c9fe9` / `fcfbc1a`: label
"Schulterlange Wellen", continuous inward-falling locks instead of separate
round curls. Keep persisted key shoulderCurls unchanged for existing profiles.
All games use prepareGameCanvas() for Retina bitmaps, bounded by ~8M pixels.
Logical dimensions are canvas.viewHeight/game.viewHeight, not canvas.height;
touch mapping, physics and resizing must not depend on backing pixel density.
Modal height/top follow visualViewport independently of the app shell; scroll
only enough to keep the focused modal input visible. Unlike the source, keep
pinch zoom enabled per this project's accessibility convention.
Run `node tests/offline.test.js` for the cached asset graph and open
`tests/layout-preview.html` for narrow portrait/landscape visual checks.
Home learning modes run advanced/new to basic: precedence, semi, written,
riddles, remainder, hundreds, terms, table; mixed 1x1 follows below on mobile
and in the right column on desktop. Preserve DOM/keyboard order, not CSS order.
The offline suite also guards essential shell, responsive, learning-form and
game CSS rules. When syncing avatar styles, retain the complete app-shell
section and the written/semi-written division and game-control rules.

Vocabulator updates from 2026-10-27 (`90f1ef5`, `624222e`, UI 52/53): viewport
deduplication via lastViewport/setViewportStyle, rounded visualViewport sizes,
coalesced animation-frame work and game canvas resizing only on size changes.
Do not write the same scroll position while typing. No vocab-only answer-form
helpers are needed here; retain math native forms/keypad and modal visibility.
GAME_SEASONS is the shared local annual calendar: Halloween Oct 20..31 and
Christmas Dec 1..27 (exclusive ends Nov 1 / Dec 28). Recheck at midnight and
after clock changes; all twelve games share currentGameSeason, extras via host.
Gate existing costumes, Halloween-only palettes and Cleo food rendering too;
do not mutate saved food/world or avatar values when the season switches.
Decoration must consume no gameplay random numbers, change no collisions or
rewards, use active game time, and respect reduced motion. Preserve the darker
mathServer Halloween palette/weather while restoring normal colors out of season.

## Offline behavior

`sw.js` uses a network-first strategy and falls back to cached assets or
`index.html`. When changing deployable assets or caching behavior:

- Keep the `ASSETS` list synchronized with files required offline.
- Bump `CACHE_NAME` when a release needs to invalidate previously cached
  content.
- While changes are still uncommitted, keep `CACHE_NAME` exactly one version
  above the value in `HEAD`. Do not increment it again for every additional
  edit that will be part of the same commit.
- Keep the home screen's `appVersion` text in `index.html` aligned with
  `CACHE_NAME`; `tests/offline.test.js` checks that the version numbers match.
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

## Frog Punch (2026-11-03)

Thirteenth reward, `frog-punch.js` loaded before app.js (normalization dependency),
`frog.html` launcher and `screen-frog` DOM/SVG view. Three 40-second rounds per
credit; no collision attempts. Consume only at first round start, not selection.
750ms single-frog windows, 1s per frog in a simultaneous pair (including
rise/fall); pairs about every 15 seconds, 15 holes
(3×5 portrait, 5×3 wide/landscape). Keep targets >=44px and preserve pinch zoom.
Freeze simulation/input on shared pause/visibility handling; CSS rotation changes
no hole indices. Use `FrogPunch.advance` before hits to reject expired targets.
Perfect means every appearance hit, not just every unique hole. Confetti is
inside the game screen for fullscreen support. Demo changes no persistent data.
`reward.bestFrogScore` tracks cumulative points; `frogLeaderboard` stores five
completed three-round games as `{id,at,score}`, score descending then timestamp
descending (newest insertion first for exact ties). Show local dd.mm and points,
highlight current ID only if retained. Normalize/import through topFive, defaults
0/[], preserve learning data. Partial games are not ranked or resumable on reload.
Run `node tests/frog-punch.test.js` and existing integration/offline/arcade suites.
Documentation: README is the source; regenerate/check mathTrainer HTML per AGENTS.md.


## Learning plans and Roman numerals (2026-11-04)

`config.allowedModes` is the per-profile allowlist of SESSION_MODES. Missing legacy
field defaults to all; explicit empty/invalid list normalizes to roman only.
Keep UI filtering, practiceSkillsInRange/startSession/onAnswer guards and daily
queue repair consistent; reset queues on saving plans without deleting progress.
Class 4/5 buttons are editable topic presets, not complete curricula or automatic
upgrades to arithmetic ranges. Extra parent controls live in native details.
Public switching to another profile requires the existing parent PIN via a pending
callback; cancel clears it. Active identity/avatar edits remain public.
Roman mode uses roman:toRoman/roman:toArabic and profile.romanSkills, operation roman.
Include in normalization, totals, history and backups. config.romanMin/romanMax are
clamped to 1..3999. toRoman uses canonical IV/IX/XL/XC/CD/CM. Both directions in
rounds of >=2; only source number and = ? in prompts (no direction wording).
Always use the compact character input: IVXLCDM or 0..9, backspace and submit;
ignore normal choice/adaptive for this mode. Explain each nonzero decimal place
in both directions (2026: 2000=MM,20=XX,6=VI); preserve retries/rewards, revision
guards, repeat and abort. No zero/overline numeral representation.
Run existing learning-modes/offline/arcade-extra/frog-punch suites and docs checks.


## Native keyboard and feedback (2026-11-05)

For active native question inputs at visualViewport.scale=1, follow BOTH visible
height and offsetTop: learning-input-viewport fixes the body at --app-top with
--app-height. keepLearningInputVisible scrolls only screen-question minimally.
Reset on focusout/view changes; preserve standalone 100vh fallback, independent
modal geometry, viewport write deduplication and pinch zoom. Do not claim desktop
simulation verifies the installed iPhone keyboard.
After onAnswer, wrong feedback waits indefinitely for a fresh touch/click;
correct feedback keeps its timer but supports immediate skip. Capture handlers
must run before answer handlers so submission cannot dismiss itself. Cancel the
advance touch to prevent a synthetic click answering the next question.
Invalidate answerFeedbackToken on every renderQuestion, retaining sessionRevision
guards; an old skipped timer must never regenerate the next task or close a
later wrong solution. Intermediate correctable form errors stay in the form.


## Semi-written Done keyboard (2026-11-06)

Semi inputs use type=number and enterkeyhint=done, WITHOUT numeric inputmode or
numeric pattern (those select the iOS number pad without a return key). Each
field's Enter first focuses the missing editable field of the current phase;
only fully filled phases submit through the existing onsubmit handler. Prevent implicit duplicate submit; ignore key
repeat/composition and keep revision/answering guards. App validation stays in
charge via noValidate. Preserve three-digit input limits, reject malformed number
notation, and never call setSelectionRange on a number input. Hide desktop
spinners without replacing the native keyboard. Check all three semi modes and
part/total/rest phases; desktop Enter cannot verify the native iPhone UI.


## Semi-written tablet landscape layout (2026-11-06)

At min-width 760px in landscape, semi-mode uses a shared heading plus two
columns: context/remainders/history and current inputs/actions. Keep input and
button targets >=48px, total/rest side by side, and the source equation visible.
Preserve stacking on narrow/portrait views, natural field order and normal zoom.
Only long completed-work lists get an independently scrollable, keyboard-focusable
area with an accessible name and height based on --app-height. Never discard
steps to fit the view. tests/layout-preview.html?layout=tablet shows 1024x400 and
1194x470 visible-area approximations; this is not a native iPad keyboard test.


## Vertical semi-written steps and result places (2026-11-06)

Show source equation, completed equation rows, separator and highlighted remaining
amount/divisor=? together. Label the input side with the current step. Never
show the old isolated remaining badge or a 0/divisor=? step. Result has three
H/T/U slots from the start: ___ then _5_ after 400/8=50 for 432/8. Slots reflect
the accumulated partial quotient, so adding later partial quotients may change earlier digits;
label this as the sum so far. Keep zero places blank while work remains; show real
zeros after all divisible amounts are consumed, without leading zeros.
Only parts/total phases remain. Remove proof input, hint and completion gate.
Done checks for empty editable fields before validating; 0 is filled, readonly
suggestions are skipped. Preserve one-time rewards, total-error retry and state.


## Required semi place order (2026-11-06)

For 843/3 allow 600/3,240/3,3/3 OR the shortcut 840/3,3/3. Compute the largest
divisible amount for each dividend place 100 and 10, deduplicate; use place 1
only when both are impossible. 864/8 allows 800,40,24 OR 840,24, but not 800,64.
Validate allowed candidates before the quotient; hint/copy/intro use the same rule. Persisted
semiFree ID stays unchanged although UI now says self-entered place amounts.


## Cursor-aware app keypads (2026-11-06)

Text-input-backed app keypads (Roman and remainder) must use editKeypadValue:
insert at selectionStart, replace selections, backspace locally, retain suffix
and length limits, then collapse selection after the edit. Prevent pointerdown
focus changes on keypad buttons. Roman cleaning preserves/map selection positions
and must not rewrite unchanged values. Keep live/revision guards. This helper is
for type=text fields; never apply setSelectionRange to the semi number inputs.


## Snow camera rider bounds (2026-11-06)

Keep right-edge terrain lookahead, but prioritize the rider: visible head
(p.y - 12) >= 20% of view height; board (p.y + p.h) <= 80% grounded or
grinding, <= 90% airborne. Bounds apply after smoothing and immediately on
resize. Deep terrain framing must yield to rider bounds. Use snowViewHeight,
not fixed landscape pixels; preserve world coordinates and physics.


## 2048 single attempt (2026-11-06)

2048 has one attempt per reward, not three. End only when canMove is false
(full board without any merge); any empty cell or possible merge keeps play
alive. Remove the old recoverTiles/two-smallest-tile rescue. On finish retain
the exact board, clear pending/animation/pointers, mark inactive/nonrunning and
reject later actions. Field pointerdown starts without moving/spawning a tile
and consumes one reward once; direction input still starts too. Five-minute
active limit, pause, demo isolation and record persistence remain unchanged.
