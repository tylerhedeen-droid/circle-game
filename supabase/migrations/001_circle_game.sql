create extension if not exists pgcrypto;
create table public.rooms (
  id uuid primary key default gen_random_uuid(), room_code text not null unique check (room_code ~ '^[A-Z2-9]{5}$'),
  host_player_id uuid, status text not null default 'lobby' check (status in ('lobby','drawing','results','closed')),
  reveal_mode text not null default 'all_submitted' check (reveal_mode in ('immediate','all_submitted')),
  current_round integer not null default 0 check (current_round >= 0), created_at timestamptz not null default now()
);
create table public.players (
  id uuid primary key default gen_random_uuid(), room_id uuid not null references public.rooms(id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) between 1 and 24), joined_at timestamptz not null default now(), is_host boolean not null default false,
  unique(room_id, display_name), unique(id, room_id)
);
alter table public.rooms add constraint rooms_host_player_fk foreign key (host_player_id, id) references public.players(id, room_id) deferrable initially deferred;
create table public.attempts (
  id uuid primary key default gen_random_uuid(), room_id uuid not null references public.rooms(id) on delete cascade,
  player_id uuid not null, round_number integer not null check (round_number > 0), score numeric(4,1) not null check (score between 0 and 100), rating text not null,
  radial_error numeric not null, closure_error numeric not null, smoothness_score numeric not null, angular_coverage numeric not null,
  points jsonb not null default '[]', created_at timestamptz not null default now(), unique(player_id, round_number),
  foreign key(player_id,room_id) references public.players(id,room_id) on delete cascade
);
create index players_room_idx on public.players(room_id);
create index attempts_room_round_idx on public.attempts(room_id,round_number,score desc);
alter table public.rooms enable row level security; alter table public.players enable row level security; alter table public.attempts enable row level security;
-- Anonymous party play deliberately permits public-anon access to unguessable UUID room rows and short-code discovery.
-- The browser never receives a service-role key. For a higher-security production version, add signed anonymous auth + membership claims.
create policy "anon read active rooms" on public.rooms for select to anon using (status <> 'closed');
create policy "anon create rooms" on public.rooms for insert to anon with check (host_player_id is null and status='lobby' and current_round=0);
create policy "anon update active rooms" on public.rooms for update to anon using (status <> 'closed') with check (status in ('lobby','drawing','results','closed'));
create policy "anon read players" on public.players for select to anon using (true);
create policy "anon join rooms" on public.players for insert to anon with check (exists(select 1 from public.rooms r where r.id=room_id and r.status <> 'closed'));
create policy "anon read attempts" on public.attempts for select to anon using (true);
create policy "anon submit once" on public.attempts for insert to anon with check (exists(select 1 from public.rooms r where r.id=room_id and r.status='drawing' and r.current_round=round_number) and exists(select 1 from public.players p where p.id=player_id and p.room_id=attempts.room_id));
alter publication supabase_realtime add table public.rooms, public.players, public.attempts;
