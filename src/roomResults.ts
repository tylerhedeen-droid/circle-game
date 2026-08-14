import type { Attempt, Player, Room } from './supabase'
import { scoreStroke } from './scoring'

export type RankedAttempt=Attempt&{playerName:string;rank:number;winner:boolean}
export type RoundHistory={roundNumber:number;results:RankedAttempt[]}
export const completedResultsRound=(room:Pick<Room,'status'|'current_round'|'last_completed_round'>)=>room.last_completed_round||(room.status==='results'?room.current_round:0)
export const circleResultPreview=(attempt:Attempt)=>({points:attempt.points,score:{...scoreStroke(attempt.points),score:attempt.score}})

export function rankedRound(attempts:Attempt[],players:Player[],roundNumber:number):RankedAttempt[]{
  const names=new Map(players.map(p=>[p.id,p.display_name]))
  return attempts.filter(a=>a.round_number===roundNumber).sort((a,b)=>b.score-a.score||a.created_at.localeCompare(b.created_at)).map((a,i)=>({...a,playerName:names.get(a.player_id)||'Player',rank:i+1,winner:i===0}))
}
export function roundHistory(attempts:Attempt[],players:Player[],currentRound:number):RoundHistory[]{
  return [...new Set(attempts.map(a=>a.round_number))].filter(n=>n<currentRound).sort((a,b)=>b-a).map(roundNumber=>({roundNumber,results:rankedRound(attempts,players,roundNumber)}))
}
export function mayRevealCurrent(room:Pick<Room,'status'|'reveal_mode'>){return room.status==='results'||room.reveal_mode==='immediate'}
export function restoredRoomView(status:Room['status']){return status==='results'?'results':'game'}
export function sessionRows(attempts:Attempt[],players:Player[]){
  const wins=new Map<string,number>()
  for(const round of new Set(attempts.map(a=>a.round_number))){const rows=attempts.filter(a=>a.round_number===round);if(!rows.length)continue;const top=Math.max(...rows.map(a=>a.score));rows.filter(a=>a.score===top).forEach(a=>wins.set(a.player_id,(wins.get(a.player_id)||0)+1))}
  return players.map(p=>{const all=attempts.filter(a=>a.player_id===p.id);return{player:p,played:all.length,wins:wins.get(p.id)||0,average:all.length?all.reduce((s,a)=>s+a.score,0)/all.length:null,best:all.length?Math.max(...all.map(a=>a.score)):null}}).sort((a,b)=>b.wins-a.wins||(b.average??-Infinity)-(a.average??-Infinity))
}
