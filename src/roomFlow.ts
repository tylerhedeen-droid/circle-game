import type { Room } from './supabase'
export const MIN_EXPECTED_PLAYERS=2,MAX_EXPECTED_PLAYERS=10
export const validExpectedPlayerCount=(count:number)=>Number.isInteger(count)&&count>=MIN_EXPECTED_PLAYERS&&count<=MAX_EXPECTED_PLAYERS
export function canChangeExpectedPlayerCount(room:Pick<Room,'current_round'>,active:number,attempts:number,next:number,current:number){
  if(!validExpectedPlayerCount(next)||next<active)return false
  return next<current||(next>current&&room.current_round===1&&attempts===0)
}
export function activeGameStatus(room:Pick<Room,'status'|'current_round'|'expected_player_count'|'match_status'|'last_completed_round'>,players:number,mineSubmitted:boolean,submittedCount=0){
  if(room.match_status==='finished'||room.status==='closed')return'Game complete'
  if(room.status==='results')return`Round ${room.current_round} results ready`
  if(mineSubmitted)return players===room.expected_player_count&&submittedCount<players?`Round ${room.current_round} · ${players}/${room.expected_player_count} players · Waiting for ${players-submittedCount}`:`Round ${room.current_round} · ${players}/${room.expected_player_count} players · You submitted`
  if(room.last_completed_round===room.current_round)return`Round ${room.current_round} results ready`
  return`Round ${room.current_round} · Your turn`
}
export function homeNavigationPreservesRoom(){return true}
