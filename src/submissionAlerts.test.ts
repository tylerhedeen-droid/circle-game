import {describe,expect,it} from 'vitest'
import {SubmissionAlertTracker} from './submissionAlerts'
describe('submission alerts',()=>it('suppresses replay and reconnect duplicates',()=>{const t=new SubmissionAlertTracker();t.seed(['old']);expect(t.accept('old')).toBe(false);expect(t.accept('new')).toBe(true);expect(t.accept('new')).toBe(false)}))

import {RealtimeNoticeTracker,noticeText} from './submissionAlerts'
describe('realtime notice helpers',()=>{
  it('formats every multiplayer event',()=>{
    expect(noticeText({kind:'player_joined',playerId:'p',playerName:'Maya'})).toBe('Maya joined')
    expect(noticeText({kind:'round_submitted',attemptId:'a',playerName:'Lee',round:2})).toBe('Lee submitted Round 2')
    expect(noticeText({kind:'round_complete',round:2})).toBe('Round 2 complete — results ready')
    expect(noticeText({kind:'round_ready',round:3})).toBe('Round 3 ready')
  })
  it('deduplicates semantic notices after seed, replay, and reconnect',()=>{const t=new RealtimeNoticeTracker();t.seed(['player:p']);expect(t.accept({kind:'player_joined',playerId:'p',playerName:'Maya'})).toBe(false);const event={kind:'round_ready',round:4} as const;expect(t.accept(event)).toBe(true);expect(t.accept(event)).toBe(false)})
})
