export type RoundState={status:'drawing'|'results';participants:Set<string>;submitted:Set<string>;transitionCount:number}
export const startRound=(playerIds:string[]):RoundState=>({status:'drawing',participants:new Set(playerIds),submitted:new Set(),transitionCount:0})
export function submitAttempt(state:RoundState,playerId:string){
  if(!state.participants.has(playerId))return state
  if(state.submitted.has(playerId))return state
  state.submitted.add(playerId);return completeIfReady(state)
}
export function completeIfReady(state:RoundState){
  if(state.status==='drawing'&&state.participants.size>0&&[...state.participants].every(id=>state.submitted.has(id))){state.status='results';state.transitionCount++}
  return state
}
export function removeParticipant(state:RoundState,playerId:string){state.participants.delete(playerId);return completeIfReady(state)}
export type MultiplayerLifecycle='loading'|'lobby'|'draw'|'submitted_waiting'|'waiting_next_round'|'results'|'closed'
export type MultiplayerResolutionInput={
  room:{id:string;room_code:string;status:'lobby'|'drawing'|'results'|'closed';current_round:number}|null
  playerId:string|null
  participant:{player_id:string;round_number:number;is_active:boolean}|null
  attempt:{player_id:string;round_number:number}|null
}
/** The single authoritative multiplayer resolver. Callers must supply rows fetched
 * for room.current_round; transient navigation/localStorage is intentionally absent. */
export function resolveMultiplayerState({room,playerId,participant,attempt}:MultiplayerResolutionInput):MultiplayerLifecycle{
  if(!room||!playerId)return'loading'
  if(room.status==='closed')return'closed'
  if(room.status==='lobby')return'lobby'
  if(room.status==='results')return'results'
  const included=participant?.player_id===playerId&&participant.round_number===room.current_round&&participant.is_active
  if(!included)return'waiting_next_round'
  const submitted=attempt?.player_id===playerId&&attempt.round_number===room.current_round
  return submitted?'submitted_waiting':'draw'
}
