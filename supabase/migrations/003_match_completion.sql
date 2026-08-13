-- Persistent overall match state for Circle v1.3.0. Safe after migrations 001 and 002.
alter table public.rooms add column if not exists match_status text not null default 'active' check (match_status in ('active','finished'));
alter table public.rooms add column if not exists match_length integer not null default 3 check (match_length >= 1);
alter table public.rooms add column if not exists is_extended boolean not null default false;

-- Starting is blocked after a match finishes. Keep Playing uses the dedicated RPC below.
create or replace function public.start_circle_round(p_room_id uuid, p_host_player_id uuid)
returns public.rooms language plpgsql security definer set search_path = public as $$
declare v_room public.rooms;
begin
  select * into v_room from public.rooms where id=p_room_id for update;
  if v_room.id is null or v_room.status='closed' then raise exception 'room_closed'; end if;
  if v_room.host_player_id is distinct from p_host_player_id then raise exception 'host_required'; end if;
  if v_room.match_status='finished' then raise exception 'match_finished'; end if;
  if v_room.status not in ('lobby','results') then raise exception 'round_already_active'; end if;
  update public.rooms set current_round=current_round+1,status='drawing' where id=p_room_id returning * into v_room;
  insert into public.round_participants(room_id,round_number,player_id)
    select p_room_id,v_room.current_round,p.id from public.players p where p.room_id=p_room_id and p.is_active
    on conflict do nothing;
  return v_room;
end $$;

-- Round completion and normal three-round match completion are one serialized decision.
create or replace function public.complete_circle_round(p_room_id uuid, p_round_number integer)
returns text language plpgsql security definer set search_path = public as $$
declare v_room public.rooms; v_has_participants boolean; v_missing boolean;
begin
  select * into v_room from public.rooms where id=p_room_id for update;
  if v_room.id is null then return 'missing'; end if;
  if v_room.status='results' and v_room.current_round=p_round_number then return case when v_room.match_status='finished' then 'finished' else 'results' end; end if;
  if v_room.status<>'drawing' or v_room.current_round<>p_round_number then return v_room.status; end if;
  select exists(select 1 from public.round_participants rp where rp.room_id=p_room_id and rp.round_number=p_round_number and rp.is_active) into v_has_participants;
  select exists(select 1 from public.round_participants rp where rp.room_id=p_room_id and rp.round_number=p_round_number and rp.is_active and not exists(select 1 from public.attempts a where a.room_id=rp.room_id and a.round_number=rp.round_number and a.player_id=rp.player_id)) into v_missing;
  if v_has_participants and not v_missing then
    update public.rooms set status='results',match_status=case when not is_extended and current_round>=match_length then 'finished' else match_status end where id=p_room_id and status='drawing' and current_round=p_round_number;
    select * into v_room from public.rooms where id=p_room_id;
    return case when v_room.match_status='finished' then 'finished' else 'results' end;
  end if;
  return 'drawing';
end $$;

create or replace function public.end_circle_match(p_room_id uuid,p_host_player_id uuid)
returns boolean language plpgsql security definer set search_path=public as $$
begin
  update public.rooms set match_status='finished',status='results' where id=p_room_id and host_player_id=p_host_player_id and status='results';
  if not found then raise exception 'host_or_results_required'; end if;
  return true;
end $$;

create or replace function public.extend_circle_match(p_room_id uuid,p_host_player_id uuid)
returns public.rooms language plpgsql security definer set search_path=public as $$
begin
  update public.rooms set match_status='active',is_extended=true where id=p_room_id and host_player_id=p_host_player_id and status='results' and match_status='finished';
  if not found then raise exception 'host_or_finished_required'; end if;
  return public.start_circle_round(p_room_id,p_host_player_id);
end $$;

grant execute on function public.end_circle_match(uuid,uuid) to anon;
grant execute on function public.extend_circle_match(uuid,uuid) to anon;
