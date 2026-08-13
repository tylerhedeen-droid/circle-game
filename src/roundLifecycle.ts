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
export function restoreRoundScreen(status:'lobby'|'drawing'|'results'|'closed',included:boolean,submitted:boolean){
  if(status==='results')return 'result'
  if(status==='closed')return 'ended'
  if(status==='drawing'&&included&&!submitted)return 'draw'
  return 'lobby'
}
