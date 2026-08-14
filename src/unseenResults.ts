import type {Attempt, Room} from './supabase'

const STORAGE_KEY='circle-viewed-rounds-v1'
export type ViewedRounds=Record<string,number[]>
export const resultIdentity=(roomId:string,playerId:string)=>`${roomId}:${playerId}`

export function readViewedRounds(storage:Pick<Storage,'getItem'>=localStorage):ViewedRounds{
  try{return JSON.parse(storage.getItem(STORAGE_KEY)||'{}') as ViewedRounds}catch{return{}}
}
export function hasViewedRound(roomId:string,playerId:string,round:number,storage:Pick<Storage,'getItem'>=localStorage){return(readViewedRounds(storage)[resultIdentity(roomId,playerId)]||[]).includes(round)}
export function markRoundViewed(roomId:string,playerId:string,round:number,storage:Pick<Storage,'getItem'|'setItem'>=localStorage){
  const state=readViewedRounds(storage),key=resultIdentity(roomId,playerId),rounds=new Set(state[key]||[]);rounds.add(round);state[key]=[...rounds].sort((a,b)=>a-b);storage.setItem(STORAGE_KEY,JSON.stringify(state))
}
export function unseenCompletedRound(room:Pick<Room,'id'|'last_completed_round'>,playerId:string,attempts:Pick<Attempt,'round_number'>[],storage:Pick<Storage,'getItem'>=localStorage){
  const completed=[...new Set(attempts.map(a=>a.round_number))].filter(r=>r<=room.last_completed_round).sort((a,b)=>a-b)
  return completed.find(r=>!hasViewedRound(room.id,playerId,r,storage))||0
}

export type SmartRoomView='game'|'results'|'full'
export function smartRoomView(room:Pick<Room,'id'|'status'|'match_status'|'last_completed_round'>,playerId:string,attempts:Pick<Attempt,'round_number'>[],storage:Pick<Storage,'getItem'>=localStorage):{view:SmartRoomView;round?:number}{
  const unseen=unseenCompletedRound(room,playerId,attempts,storage)
  if(unseen)return{view:'results',round:unseen}
  if(room.match_status==='finished'||room.status==='closed')return{view:'full'}
  return{view:'game'}
}
