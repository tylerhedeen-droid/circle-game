import type {Attempt,Player,Room} from './supabase'

export type RealtimeNotice=
  |{kind:'player_joined';playerId:string;playerName:string}
  |{kind:'round_submitted';attemptId:string;playerName:string;round:number}
  |{kind:'round_complete';round:number}
  |{kind:'round_ready';round:number}

export const noticeKey=(n:RealtimeNotice)=>n.kind==='player_joined'?`player:${n.playerId}`:n.kind==='round_submitted'?`attempt:${n.attemptId}`:`${n.kind}:${n.round}`
export const noticeText=(n:RealtimeNotice)=>n.kind==='player_joined'?`${n.playerName} joined the game`:n.kind==='round_submitted'?`${n.playerName} submitted Round ${n.round}`:n.kind==='round_complete'?`Round ${n.round} complete — results are ready`:`Round ${n.round} is ready — your turn`

/** A semantic, bounded ledger. Seed it from authoritative state before listening. */
export class RealtimeNoticeTracker{
  private seen=new Set<string>()
  seed(keys:string[]){keys.forEach(k=>this.seen.add(k))}
  accept(n:RealtimeNotice){const key=noticeKey(n);if(this.seen.has(key))return false;this.seen.add(key);return true}
}

export const snapshotKeys=(room:Pick<Room,'current_round'|'last_completed_round'>,players:Pick<Player,'id'>[],attempts:Pick<Attempt,'id'>[])=>[
  ...players.map(p=>`player:${p.id}`),...attempts.map(a=>`attempt:${a.id}`),
  ...Array.from({length:room.last_completed_round},(_,i)=>`round_complete:${i+1}`),
  ...Array.from({length:Math.max(0,room.current_round-1)},(_,i)=>`round_ready:${i+2}`),
]

/** Diff database snapshots, so reconnects and missed individual callbacks are safe. */
export function noticesFromSnapshot(before:{room:Room;players:Player[];attempts:Attempt[]},after:{room:Room;players:Player[];attempts:Attempt[]},myId:string):RealtimeNotice[]{
  const out:RealtimeNotice[]=[], oldPlayers=new Set(before.players.map(p=>p.id)),oldAttempts=new Set(before.attempts.map(a=>a.id))
  after.players.filter(p=>!oldPlayers.has(p.id)&&p.id!==myId).forEach(p=>out.push({kind:'player_joined',playerId:p.id,playerName:p.display_name}))
  after.attempts.filter(a=>!oldAttempts.has(a.id)&&a.player_id!==myId).forEach(a=>out.push({kind:'round_submitted',attemptId:a.id,playerName:after.players.find(p=>p.id===a.player_id)?.display_name||'A player',round:a.round_number}))
  for(let r=before.room.last_completed_round+1;r<=after.room.last_completed_round;r++)out.push({kind:'round_complete',round:r})
  if(after.room.current_round>before.room.current_round&&after.room.status==='drawing')out.push({kind:'round_ready',round:after.room.current_round})
  return out
}
