export class SubmissionAlertTracker{
  private seen=new Set<string>()
  seed(ids:string[]){ids.forEach(id=>this.seen.add(id))}
  accept(id:string){if(this.seen.has(id))return false;this.seen.add(id);return true}
}
