# Changelog

All notable changes to Circle are documented here. This project follows the general structure of [Keep a Changelog](https://keepachangelog.com/), with versions organized by release date.

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
