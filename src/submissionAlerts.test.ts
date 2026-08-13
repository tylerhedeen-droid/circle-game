import {describe,expect,it} from 'vitest'
import {SubmissionAlertTracker} from './submissionAlerts'
describe('submission alerts',()=>it('suppresses replay and reconnect duplicates',()=>{const t=new SubmissionAlertTracker();t.seed(['old']);expect(t.accept('old')).toBe(false);expect(t.accept('new')).toBe(true);expect(t.accept('new')).toBe(false)}))
