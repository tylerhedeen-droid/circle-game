# Circle

See [CHANGELOG.md](CHANGELOG.md) for version history and notable updates.

A mobile-first party game: draw one freehand circle, get a believable roundness score, and compete with friends in a live private room. Solo Practice works without a backend; multiplayer uses Supabase Realtime.

## What is included

- One-stroke, scroll-safe pointer canvas with fitted-circle overlay
- Deterministic scoring for radial consistency, closure, smoothness, angular coverage, and retracing
- Synthetic scoring tests and a development-only diagnostics panel
- Anonymous room creation/joining, configurable reveal mode, live lobby and round updates
- Round and cumulative session leaderboards
- localStorage session restoration and solo personal best
- Web Share with clipboard fallback
- Installable PWA and GitHub Pages-compatible production build

## Supabase setup

1. Create a Supabase project.
2. Open **SQL Editor**, paste the complete contents of [`supabase/migrations/001_circle_game.sql`](supabase/migrations/001_circle_game.sql), and run it once.
3. In **Project Settings → API**, copy the Project URL and public anon/publishable key.
4. Copy `.env.example` to `.env.local` and fill in:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_KEY
```

Never use the service-role key in this app. The included RLS is intentionally permissive for frictionless anonymous party play. It prevents direct unauthenticated update/delete access to players and attempts, but a determined client can still inspect active public room data or update a room. For an internet-scale competitive version, use Supabase anonymous auth and server-side RPCs that validate host/player ownership.

## Local commands

Requires Node.js 20 or newer.

```bash
npm install
npm run dev
npm test
npm run build
npm run preview
```

Solo Practice works when the two Supabase values are blank. Multiplayer shows a friendly setup message.

## Deploy to GitHub Pages

1. Create a GitHub repository named `circle-game` and push this repository to it.
2. In GitHub, open **Settings → Secrets and variables → Actions → New repository secret**. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
3. Open **Settings → Pages** and set **Source** to **GitHub Actions**.
4. The included workflow deploys every push to `main`. You can also run it from the **Actions** tab.
5. The app will be available at `https://YOUR_USERNAME.github.io/circle-game/`.

If the repository has a different name, change `base` in `vite.config.ts` to `/<repository-name>/`.

## Mobile testing checklist

- On iPhone Safari and Android Chrome, draw near every canvas edge; the page must not scroll.
- Try a tap, line, tiny loop, open arc, ellipse, good circle, jagged circle, and double-traced circle.
- Add the PWA to the home screen, launch it standalone, and verify Solo Practice offline after the first load.
- Create a room on one phone and join on another network; confirm players and attempts update without refresh.
- Test both score reveal modes and start two rounds; inspect session averages, wins, and best scores.
- Refresh both host and guest during a room and confirm local session restoration.
- Test Share Game and its copy fallback.

## Known first-version limitations

- The score thresholds are synthetic-test tuned. Real thumb/stylus samples should be collected to tune radial and smoothness tolerances.
- Anonymous no-account identity cannot reliably distinguish a closed tab from a temporary disconnect; players remain in the lobby for the room session.
- Host authority is represented in the database, but the permissive anonymous RLS cannot cryptographically prove the caller is that host. Production-hardening needs anonymous Supabase Auth plus RPCs/Edge Functions.
- The PWA uses a scalable placeholder icon. Replace it with polished 192×192 and 512×512 PNG icons for the best iOS presentation.
