import {describe,expect,it} from 'vitest'
import {playerJoinedNotice,playerSubmittedNotice,roundCompleteNotice,roundReadyNotice,SubmissionAlertTracker} from './submissionAlerts'
describe('submission alerts',()=>it('suppresses replay and reconnect duplicates',()=>{const t=new SubmissionAlertTracker();t.seed(['old']);expect(t.accept('old')).toBe(false);expect(t.accept('new')).toBe(true);expect(t.accept('new')).toBe(false)}))
describe('activity notice copy',()=>{
  it('describes joins',()=>expect(playerJoinedNotice('Mike')).toBe('Mike joined the game'))
  it('describes submissions with their round',()=>expect(playerSubmittedNotice('Mike',2)).toBe('Mike submitted Round 2'))
  it('describes completion',()=>expect(roundCompleteNotice(2)).toBe('Round 2 complete — results are ready'))
  it('describes the automatically ready round',()=>expect(roundReadyNotice(3)).toBe('Round 3 is ready'))
})
