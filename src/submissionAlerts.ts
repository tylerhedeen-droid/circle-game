export class SubmissionAlertTracker{
  private seen=new Set<string>()
  seed(ids:string[]){ids.forEach(id=>this.seen.add(id))}
  accept(id:string){if(this.seen.has(id))return false;this.seen.add(id);return true}
}
export const playerJoinedNotice=(name:string)=>`${name} joined the game`
export const playerSubmittedNotice=(name:string,round:number)=>`${name} submitted Round ${round}`
export const roundCompleteNotice=(round:number)=>`Round ${round} complete — results are ready`
export const roundReadyNotice=(round:number)=>`Round ${round} is ready`
