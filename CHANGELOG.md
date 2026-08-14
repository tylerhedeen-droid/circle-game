# Changelog

All notable changes to Circle are documented here. This project follows the general structure of [Keep a Changelog](https://keepachangelog.com/), with versions organized by release date.

## [1.4.2] - 2026-08-14

### Added

- Queued, semantic in-app activity alerts and authoritative persistent room/Active Games attention states.
- Persistent Full Match Results with overall statistics and stored circle comparisons for every completed round.

### Fixed

- Realtime notices now reconcile authoritative snapshots after events and reconnects without replaying old activity or announcing a player's own submission.
- The displayed application version now matches the package release version.

## [1.4.1] - 2026-08-14

### Added

- Responsive completed-round comparison cards showing each stored circle, fitted-circle overlay, rank, player, rating, and score.

### Fixed

- Round 2 and later `next_round_ready` states are drawable instead of becoming stuck on the loading screen.
- Realtime join, submission, round-complete, and next-round notices are deduplicated across refreshes and reconnects.
- Results remain associated with `last_completed_round` when the next round opens automatically.

## [1.4.0] - 2026-08-13

### Added

- Expected player counts (2–10), authoritative capacity enforcement, and host-confirmed count reduction.
- Immediately open asynchronous Round 1 play and automatic Round 2/3/4+ preparation.
- Full-roster-and-full-submission server completion rule, dynamic current-round eligibility, and asynchronous Active Game status.
- Additive Supabase migration `004_async_expected_players.sql` with safe legacy-room backfill.

### Changed

- Removed normal host Start Round gates; players can submit whenever their authoritative current round is ready.
- Participant rows now track all active players who join while the current round remains open.

## [1.3.0] - 2026-08-13

### Added

- Authoritative three-round multiplayer matches with automatic final results.
- Overall winner ranking by round wins, average score, then best score, with exact ties preserved.
- Final Results screen with match standings and compact individual-round history.
- Confirmed End Game control for hosts after any completed round.
- Keep Playing control that starts Round 4 and preserves all history in an extended game.
- Persistent match status so guests, refreshed clients, and reopened Active Games agree on completion.
- Additive Supabase migration `003_match_completion.sql`.

## [1.2.2] - 2026-08-13

### Fixed

- New multiplayer rooms remain in the lobby until the host explicitly starts a round.
- Competitive rounds require at least two active players; one-player lobbies show a clear waiting message.
- Start Round enables automatically after another player joins through Realtime.
- Persistent Home navigation now exits every room view without leaving, closing, or removing the game.
- The Game tab continues to reflect the authoritative lobby, draw, waiting, or results lifecycle rather than forcing a drawing canvas.
- Shared links continue to join or restore the lobby without starting a round.

## [1.2.1] - 2026-08-13

### Fixed

- Shared game URLs now contain the room code and restore an existing device identity directly.
- One authoritative lifecycle resolver now controls shared links, Active Games, refresh, Realtime, tabs, rejoin, and submission reconciliation.
- A persisted current-round attempt always resolves to submitted/waiting and can never reopen the drawing canvas.
- Submission waits for the persisted attempt row before completing and re-resolving the room.
- Missing attempts and nonparticipants no longer appear as false `0.0` scores in standings or session statistics.
- Current-round identity always comes from the freshly fetched room, participant, and attempt rows.

### Added

- Development-only lifecycle diagnostics containing room, round, participant, attempt, and resolved-state information.

## [1.2.0] - 2026-08-13

### Added

- Persistent Game, Results, History, and Session room navigation.
- Compact round history generated from existing attempt records, newest round first.
- Dedicated final standings with rank, score, rating, winner, and current-player highlighting.

### Fixed

- Completed-round results remain accessible after internal navigation, refresh, PWA reopen, Active Games access, or rejoin.
- All participating players can return to the complete leaderboard until the host starts the next round.
- Starting a new round preserves prior results in history and cumulative session statistics.
- Hidden reveal mode does not expose current-round scores before results.

## [1.1.1] - 2026-08-13

### Fixed

- Round completion no longer depends on the host client or the mutable room player list.
- Guests now transition automatically from submitted/waiting state to results through Realtime.
- Per-round participant snapshots prevent late joiners and abandoned players from blocking a round.
- Completion is server-side, race-safe, and idempotent for simultaneous submissions and duplicate events.
- Leaving Active Games retains the device's server-side player identity so the same room can be rejoined.
- Rejoining restores host status, submitted state, active drawing state, or current results as appropriate.

### Added

- Host control for removing an inactive participant; removal can immediately complete a waiting round.
- Additive Supabase migration `002_multiplayer_reliability.sql`.
- Automated multiplayer lifecycle coverage for two- and three-player rounds, ordering, races, refresh, removal, late joins, rejoin, and next-round reset.

## [1.1.0] - 2026-08-13

### Added

- Versioned local storage for multiple active multiplayer rooms on one device.
- Active Games section with room status, Open, and Remove controls.
- Realtime player-submission banners with subtle haptic feedback.
- Compact `Submitted ✓` and `Drawing…` player states during active rounds.
- User-controlled PWA update prompt that avoids interrupting an active drawing.
- App version display on the home screen and scoring diagnostics.
- Automated tests for result framing, multi-room sessions, session removal, switching rooms, and duplicate alert suppression.

### Changed

- Result previews now fit and center the complete stroke and fitted-circle overlay with safe visual padding.
- Scoring calibration is more selective: average human circles score lower while near-perfect synthetic circles remain near 100.
- Scoring weights and normalization thresholds are centralized in a tunable configuration object.
- Outdated PWA caches are cleaned up when new versions are installed.

## [1.0.1] - 2026-08-13

### Changed

- Standardized the repository on npm 11.17.0 and Node.js 20 or newer.
- Replaced pnpm configuration and lockfiles with an npm `package-lock.json`.
- Removed pnpm-generated dependency state that prevented reliable npm installation on Windows.

## [1.0.0] - 2026-08-13

### Added

- Mobile-first one-stroke circle drawing and deterministic roundness scoring.
- Solo Practice with a locally stored personal best.
- Anonymous Supabase multiplayer rooms, realtime lobbies, rounds, and leaderboards.
- Immediate and all-submitted score reveal modes.
- Session statistics, room sharing, and local session restoration.
- Installable PWA support and GitHub Pages deployment workflow.
- Supabase schema, environment setup, deployment documentation, and synthetic scoring tests.
