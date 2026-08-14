-- Asynchronous expected-roster multiplayer for Circle v1.4.0.
-- Additive and safe to run once after 001, 002, and 003.
alter table public.rooms add column if not exists expected_player_count integer;
alter table public.rooms add column if not exists last_completed_round integer not null default 0;

-- Legacy rooms inherit their active roster, with the competitive minimum of two.
update public.rooms r set expected_player_count=greatest(2,(
  select count(*)::integer from public.players p where p.room_id=r.id and p.is_active
)) where expected_player_count is null;
alter table public.rooms alter column expected_player_count set default 2;
alter table public.rooms alter column expected_player_count set not null;
alter table public.rooms add constraint rooms_expected_player_count_check check (expected_player_count between 2 and 10);

-- Legacy lobbies become immediately playable Round 1 rooms. Existing drawing
-- rooms retain their round and roster; completed-result rooms retain their view.
update public.rooms set status='drawing',current_round=1 where status='lobby';
insert into public.round_participants(room_id,round_number,player_id)
select r.id,r.current_round,p.id from public.rooms r join public.players p on p.room_id=r.id
where r.status='drawing' and r.current_round>0 and p.is_active on conflict do nothing;

create or replace function public.create_circle_game(p_room_code text,p_display_name text,p_expected integer)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_room public.rooms; v_player public.players;
begin
  if p_expected not between 2 and 10 then raise exception 'invalid_expected_player_count'; end if;
  insert into public.rooms(room_code,status,current_round,reveal_mode,expected_player_count)
    values(upper(p_room_code),'drawing',1,'all_submitted',p_expected) returning * into v_room;
  insert into public.players(room_id,display_name,is_host,is_active) values(v_room.id,trim(p_display_name),true,true) returning * into v_player;
  update public.rooms set host_player_id=v_player.id where id=v_room.id returning * into v_room;
  insert into public.round_participants(room_id,round_number,player_id) values(v_room.id,1,v_player.id);
  return jsonb_build_object('room',to_jsonb(v_room),'player',to_jsonb(v_player));
end $$;

-- Capacity and current-round eligibility are serialized with the room lock.
create or replace function public.join_circle_game(p_room_id uuid,p_display_name text)
returns public.players language plpgsql security definer set search_path=public as $$
declare v_room public.rooms; v_player public.players; v_active integer;
begin
  select * into v_room from public.rooms where id=p_room_id for update;
  if v_room.id is null or v_room.status='closed' or v_room.match_status='finished' then raise exception 'room_closed'; end if;
  select count(*) into v_active from public.players where room_id=p_room_id and is_active;
  if v_active>=v_room.expected_player_count then raise exception 'game_full'; end if;
  insert into public.players(room_id,display_name,is_host,is_active) values(p_room_id,trim(p_display_name),false,true) returning * into v_player;
  if v_room.status='drawing' then
    insert into public.round_participants(room_id,round_number,player_id) values(p_room_id,v_room.current_round,v_player.id) on conflict do nothing;
  end if;
  return v_player;
end $$;

-- Restores an existing identity and also initializes the creator/current-round
-- participant after the room's deferred host relationship has been established.
create or replace function public.rejoin_circle_player(p_room_id uuid,p_player_id uuid)
returns boolean language plpgsql security definer set search_path=public as $$
declare v_room public.rooms; v_active integer;
begin
  select * into v_room from public.rooms where id=p_room_id for update;
  if v_room.id is null or v_room.status='closed' then raise exception 'room_closed'; end if;
  select count(*) into v_active from public.players where room_id=p_room_id and is_active and id<>p_player_id;
  if v_active>=v_room.expected_player_count then raise exception 'game_full'; end if;
  update public.players set is_active=true where id=p_player_id and room_id=p_room_id;
  if not found then return false; end if;
  if v_room.status='drawing' then insert into public.round_participants(room_id,round_number,player_id) values(p_room_id,v_room.current_round,p_player_id) on conflict do update set is_active=true; end if;
  return true;
end $$;

-- One serialized resolver: a round needs a full expected roster and one real
-- attempt per eligible active player. It opens the next round automatically,
-- while last_completed_round keeps prior results/history addressable.
create or replace function public.complete_circle_round(p_room_id uuid,p_round_number integer)
returns text language plpgsql security definer set search_path=public as $$
declare v_room public.rooms; v_active integer; v_submitted integer; v_next integer;
begin
  select * into v_room from public.rooms where id=p_room_id for update;
  if v_room.id is null then return 'missing'; end if;
  if v_room.current_round<>p_round_number or v_room.status<>'drawing' then return case when v_room.match_status='finished' then 'finished' else v_room.status end; end if;
  select count(*) into v_active from public.players where room_id=p_room_id and is_active;
  select count(*) into v_submitted from public.round_participants rp
    join public.players p on p.id=rp.player_id and p.room_id=rp.room_id and p.is_active
    join public.attempts a on a.room_id=rp.room_id and a.round_number=rp.round_number and a.player_id=rp.player_id
    where rp.room_id=p_room_id and rp.round_number=p_round_number and rp.is_active;
  if v_active<>v_room.expected_player_count or v_submitted<>v_active then return 'drawing'; end if;
  if not v_room.is_extended and p_round_number>=v_room.match_length then
    update public.rooms set status='results',match_status='finished',last_completed_round=p_round_number where id=p_room_id;
    return 'finished';
  end if;
  v_next:=p_round_number+1;
  update public.rooms set status='drawing',last_completed_round=p_round_number,current_round=v_next where id=p_room_id;
  insert into public.round_participants(room_id,round_number,player_id)
    select p_room_id,v_next,p.id from public.players p where p.room_id=p_room_id and p.is_active on conflict do nothing;
  return 'next_round_ready';
end $$;

create or replace function public.change_circle_player_count(p_room_id uuid,p_host_player_id uuid,p_expected integer)
returns public.rooms language plpgsql security definer set search_path=public as $$
declare v_room public.rooms; v_active integer; v_attempts integer;
begin
  select * into v_room from public.rooms where id=p_room_id for update;
  if v_room.host_player_id is distinct from p_host_player_id then raise exception 'host_required'; end if;
  select count(*) into v_active from public.players where room_id=p_room_id and is_active;
  select count(*) into v_attempts from public.attempts where room_id=p_room_id;
  if p_expected not between 2 and 10 or p_expected<v_active then raise exception 'invalid_expected_player_count'; end if;
  if p_expected>v_room.expected_player_count and not(v_room.current_round=1 and v_attempts=0) then raise exception 'increase_not_allowed'; end if;
  update public.rooms set expected_player_count=p_expected where id=p_room_id returning * into v_room;
  perform public.complete_circle_round(p_room_id,v_room.current_round);
  select * into v_room from public.rooms where id=p_room_id;
  return v_room;
end $$;

-- Removal only frees a slot. The host explicitly confirms any roster-size change.
create or replace function public.remove_circle_player(p_room_id uuid,p_host_player_id uuid,p_player_id uuid)
returns boolean language plpgsql security definer set search_path=public as $$
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

-- Keep Playing now opens Round 4+ with the same asynchronous roster.
create or replace function public.extend_circle_match(p_room_id uuid,p_host_player_id uuid)
returns public.rooms language plpgsql security definer set search_path=public as $$
declare v_room public.rooms; v_next integer;
begin
  select * into v_room from public.rooms where id=p_room_id for update;
  if v_room.host_player_id is distinct from p_host_player_id or v_room.match_status<>'finished' then raise exception 'host_or_finished_required'; end if;
  v_next:=v_room.current_round+1;
  update public.rooms set match_status='active',is_extended=true,status='drawing',current_round=v_next where id=p_room_id returning * into v_room;
  insert into public.round_participants(room_id,round_number,player_id) select p_room_id,v_next,p.id from public.players p where p.room_id=p_room_id and p.is_active on conflict do nothing;
  return v_room;
end $$;

grant execute on function public.join_circle_game(uuid,text) to anon;
grant execute on function public.create_circle_game(text,text,integer) to anon;
grant execute on function public.change_circle_player_count(uuid,uuid,integer) to anon;

create or replace function public.end_circle_match(p_room_id uuid,p_host_player_id uuid)
returns boolean language plpgsql security definer set search_path=public as $$
begin
  update public.rooms set match_status='finished',status='results'
    where id=p_room_id and host_player_id=p_host_player_id and last_completed_round>0 and status<>'closed';
  if not found then raise exception 'host_or_completed_round_required'; end if;
  return true;
end $$;
