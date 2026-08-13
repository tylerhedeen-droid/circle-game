-- Circle multiplayer reliability upgrade. Safe to run after 001_circle_game.sql.
alter table public.players add column if not exists is_active boolean not null default true;

-- Closed rooms remain readable by code so clients can distinguish "ended" from "not found".
drop policy if exists "anon read active rooms" on public.rooms;
drop policy if exists "anon read rooms" on public.rooms;
create policy "anon read rooms" on public.rooms for select to anon using (true);

create table if not exists public.round_participants (
  room_id uuid not null references public.rooms(id) on delete cascade,
  round_number integer not null check (round_number > 0),
  player_id uuid not null,
  is_active boolean not null default true,
  joined_round_at timestamptz not null default now(),
  primary key (room_id, round_number, player_id),
  foreign key (player_id, room_id) references public.players(id, room_id) on delete cascade
);
create index if not exists round_participants_lookup_idx on public.round_participants(room_id, round_number, is_active);
alter table public.round_participants enable row level security;
drop policy if exists "anon read round participants" on public.round_participants;
create policy "anon read round participants" on public.round_participants for select to anon using (true);

-- Replace the original attempt policy so only the frozen round roster may submit.
drop policy if exists "anon submit once" on public.attempts;
create policy "anon submit participating player once" on public.attempts for insert to anon with check (
  exists(select 1 from public.rooms r where r.id=room_id and r.status='drawing' and r.current_round=round_number)
  and exists(select 1 from public.round_participants rp where rp.room_id=attempts.room_id and rp.round_number=attempts.round_number and rp.player_id=attempts.player_id and rp.is_active)
);

-- Snapshot only active players when the host starts. Late joiners wait for the next round.
create or replace function public.start_circle_round(p_room_id uuid, p_host_player_id uuid)
returns public.rooms language plpgsql security definer set search_path = public as $$
declare v_room public.rooms;
begin
  select * into v_room from public.rooms where id=p_room_id for update;
  if v_room.id is null or v_room.status='closed' then raise exception 'room_closed'; end if;
  if v_room.host_player_id is distinct from p_host_player_id then raise exception 'host_required'; end if;
  if v_room.status not in ('lobby','results') then raise exception 'round_already_active'; end if;
  update public.rooms set current_round=current_round+1,status='drawing' where id=p_room_id returning * into v_room;
  insert into public.round_participants(room_id,round_number,player_id)
    select p_room_id,v_room.current_round,p.id from public.players p where p.room_id=p_room_id and p.is_active
    on conflict do nothing;
  return v_room;
end $$;

-- Idempotent and race-safe: every client may call this after refresh or submission.
create or replace function public.complete_circle_round(p_room_id uuid, p_round_number integer)
returns text language plpgsql security definer set search_path = public as $$
declare v_room public.rooms; v_has_participants boolean; v_missing boolean;
begin
  select * into v_room from public.rooms where id=p_room_id for update;
  if v_room.id is null then return 'missing'; end if;
  if v_room.status='results' and v_room.current_round=p_round_number then return 'results'; end if;
  if v_room.status<>'drawing' or v_room.current_round<>p_round_number then return v_room.status; end if;
  select exists(select 1 from public.round_participants rp where rp.room_id=p_room_id and rp.round_number=p_round_number and rp.is_active) into v_has_participants;
  select exists(
    select 1 from public.round_participants rp
    where rp.room_id=p_room_id and rp.round_number=p_round_number and rp.is_active
      and not exists(select 1 from public.attempts a where a.room_id=rp.room_id and a.round_number=rp.round_number and a.player_id=rp.player_id)
  ) into v_missing;
  if v_has_participants and not v_missing then update public.rooms set status='results' where id=p_room_id and status='drawing' and current_round=p_round_number; return 'results'; end if;
  return 'drawing';
end $$;

create or replace function public.remove_circle_player(p_room_id uuid, p_host_player_id uuid, p_player_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_room public.rooms;
begin
  select * into v_room from public.rooms where id=p_room_id for update;
  if v_room.id is null or v_room.status='closed' then raise exception 'room_closed'; end if;
  if v_room.host_player_id is distinct from p_host_player_id then raise exception 'host_required'; end if;
  if p_player_id=v_room.host_player_id then raise exception 'cannot_remove_host'; end if;
  update public.players set is_active=false where id=p_player_id and room_id=p_room_id;
  update public.round_participants set is_active=false where room_id=p_room_id and round_number=v_room.current_round and player_id=p_player_id;
  perform public.complete_circle_round(p_room_id,v_room.current_round);
  return true;
end $$;

create or replace function public.rejoin_circle_player(p_room_id uuid, p_player_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not exists(select 1 from public.rooms where id=p_room_id and status<>'closed') then raise exception 'room_closed'; end if;
  update public.players set is_active=true where id=p_player_id and room_id=p_room_id;
  return found;
end $$;

grant execute on function public.start_circle_round(uuid,uuid) to anon;
grant execute on function public.complete_circle_round(uuid,integer) to anon;
grant execute on function public.remove_circle_player(uuid,uuid,uuid) to anon;
grant execute on function public.rejoin_circle_player(uuid,uuid) to anon;

-- Existing in-progress rooms get a one-time participant snapshot.
insert into public.round_participants(room_id,round_number,player_id)
select r.id,r.current_round,p.id from public.rooms r join public.players p on p.room_id=r.id
where r.status='drawing' and r.current_round>0 and p.is_active on conflict do nothing;

do $$ begin
  alter publication supabase_realtime add table public.round_participants;
exception when duplicate_object then null;
end $$;
