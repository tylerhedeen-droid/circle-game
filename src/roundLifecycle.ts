export type AsyncRoundState={
  status:'drawing'|'results'
  expectedPlayerCount:number
  activePlayers:Set<string>
  submitted:Set<string>
  transitionCount:number
}

/** Small deterministic mirror of the database completion rule, used by the UI
 * and tests. Supabase remains authoritative in production. */
export const openAsyncRound=(expectedPlayerCount:number,playerIds:string[]=[]):AsyncRoundState=>({
  status:'drawing',expectedPlayerCount,activePlayers:new Set(playerIds),submitted:new Set(),transitionCount:0,
})
export function joinAsyncRound(state:AsyncRoundState,playerId:string){
  if(state.status==='drawing'&&state.activePlayers.size<state.expectedPlayerCount)state.activePlayers.add(playerId)
  return completeAsyncRoundIfReady(state)
}
export function submitAsyncAttempt(state:AsyncRoundState,playerId:string){
  if(state.status!=='drawing'||!state.activePlayers.has(playerId)||state.submitted.has(playerId))return state
  state.submitted.add(playerId);return completeAsyncRoundIfReady(state)
}
export function completeAsyncRoundIfReady(state:AsyncRoundState){
  const filled=state.activePlayers.size===state.expectedPlayerCount
  if(state.status==='drawing'&&filled&&[...state.activePlayers].every(id=>state.submitted.has(id))){state.status='results';state.transitionCount++}
  return state
}
export function reduceExpectedPlayers(state:AsyncRoundState,count:number){
  if(count<state.activePlayers.size||count>state.expectedPlayerCount)throw Error('invalid_expected_player_count')
  state.expectedPlayerCount=count;return completeAsyncRoundIfReady(state)
}
export function removeAsyncPlayer(state:AsyncRoundState,playerId:string){state.activePlayers.delete(playerId);state.submitted.delete(playerId);return completeAsyncRoundIfReady(state)}

export type MultiplayerLifecycle='loading'|'draw'|'submitted_waiting_players'|'submitted_waiting_attempts'|'next_round_ready'|'results'|'final_results'|'closed'
export const isDrawableLifecycle=(state:MultiplayerLifecycle)=>state==='draw'||state==='next_round_ready'
export type MultiplayerResolutionInput={
  room:{id:string;room_code:string;status:'lobby'|'drawing'|'results'|'closed';current_round:number;expected_player_count:number;last_completed_round?:number;match_status?:'active'|'finished'}|null
  playerId:string|null
  participant:{player_id:string;round_number:number;is_active:boolean}|null
  attempt:{player_id:string;round_number:number}|null
  activePlayerCount:number
  submittedCount:number
}
/** Navigation never participates in this decision: only freshly fetched server rows do. */
export function resolveMultiplayerState({room,playerId,participant,attempt,activePlayerCount,submittedCount}:MultiplayerResolutionInput):MultiplayerLifecycle{
  if(!room||!playerId)return'loading'
  if(room.status==='closed')return'closed'
  if(room.match_status==='finished')return'final_results'
  if(room.status==='results')return'results'
  const eligible=participant?.player_id===playerId&&participant.round_number===room.current_round&&participant.is_active
  if(!eligible)return'loading'
  const submitted=attempt?.player_id===playerId&&attempt.round_number===room.current_round
  if(!submitted)return room.last_completed_round===room.current_round-1&&room.current_round>1?'next_round_ready':'draw'
  return activePlayerCount<room.expected_player_count?'submitted_waiting_players':submittedCount<activePlayerCount?'submitted_waiting_attempts':'loading'
}
