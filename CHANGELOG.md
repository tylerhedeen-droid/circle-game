# Changelog

All notable changes to Circle are documented here. This project follows the general structure of [Keep a Changelog](https://keepachangelog.com/), with versions organized by release date.

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
