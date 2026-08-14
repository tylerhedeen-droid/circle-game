export class SubmissionAlertTracker{
  private seen=new Set<string>()
  seed(ids:string[]){ids.forEach(id=>this.seen.add(id))}
  accept(id:string){if(this.seen.has(id))return false;this.seen.add(id);return true}
}


export type RealtimeNotice=
  |{kind:'player_joined';playerId:string;playerName:string}
  |{kind:'round_submitted';attemptId:string;playerName:string;round:number}
  |{kind:'round_complete';round:number}
  |{kind:'round_ready';round:number}
export const noticeKey=(notice:RealtimeNotice)=>notice.kind==='player_joined'?`player:${notice.playerId}`:notice.kind==='round_submitted'?`attempt:${notice.attemptId}`:`${notice.kind}:${notice.round}`
export const noticeText=(notice:RealtimeNotice)=>notice.kind==='player_joined'?`${notice.playerName} joined`:notice.kind==='round_submitted'?`${notice.playerName} submitted Round ${notice.round}`:notice.kind==='round_complete'?`Round ${notice.round} complete — results ready`:`Round ${notice.round} ready`
export class RealtimeNoticeTracker{
  private seen=new Set<string>()
  seed(keys:string[]){keys.forEach(key=>this.seen.add(key))}
  accept(notice:RealtimeNotice){const key=noticeKey(notice);if(this.seen.has(key))return false;this.seen.add(key);return true}
}
