import{describe,expect,it}from'vitest'
import{completeIfReady,removeParticipant,restoreRoundScreen,startRound,submitAttempt}from'./roundLifecycle'
describe('multiplayer round lifecycle',()=>{
  it('completes a 2-player round only after player B submits',()=>{const s=startRound(['a','b']);submitAttempt(s,'a');expect(s.status).toBe('drawing');submitAttempt(s,'b');expect(s.status).toBe('results')})
  it('keeps 3 players waiting for the third submission',()=>{const s=startRound(['a','b','c']);submitAttempt(s,'a');submitAttempt(s,'b');expect(s.status).toBe('drawing');submitAttempt(s,'c');expect(s.status).toBe('results')})
  it.each([['host','guest'],['guest','host']])('works when %s submits first',first=>{const s=startRound(['host','guest']);submitAttempt(s,first);submitAttempt(s,first==='host'?'guest':'host');expect(s.status).toBe('results')})
  it('handles near-simultaneous final submissions idempotently',()=>{const s=startRound(['a','b']);submitAttempt(s,'a');submitAttempt(s,'b');completeIfReady(s);completeIfReady(s);expect(s.transitionCount).toBe(1)})
  it('ignores duplicate submit/realtime events',()=>{const s=startRound(['a','b']);submitAttempt(s,'a');submitAttempt(s,'a');expect(s.submitted.size).toBe(1);submitAttempt(s,'b');expect(s.transitionCount).toBe(1)})
  it('restores waiting after submission',()=>{const s=startRound(['a','b']);submitAttempt(s,'a');const restored={...s,participants:new Set(s.participants),submitted:new Set(s.submitted)};expect(restored.status).toBe('drawing');expect(restored.submitted.has('a')).toBe(true)})
  it('restores results after transition',()=>{const s=startRound(['a']);submitAttempt(s,'a');expect(completeIfReady(s).status).toBe('results')})
  it('inactive player removal allows completion',()=>{const s=startRound(['a','stale']);submitAttempt(s,'a');removeParticipant(s,'stale');expect(s.status).toBe('results')})
  it('late joiners do not enter the current snapshot',()=>{const s=startRound(['a','b']);submitAttempt(s,'late');submitAttempt(s,'a');submitAttempt(s,'b');expect(s.status).toBe('results');expect(s.participants.has('late')).toBe(false)})
  it('next round resets submissions and snapshots active players',()=>{const first=startRound(['a','b']);submitAttempt(first,'a');submitAttempt(first,'b');const next=startRound(['a','c']);expect(next.status).toBe('drawing');expect(next.submitted.size).toBe(0);expect([...next.participants]).toEqual(['a','c'])})
  it('rejoin after submitting restores waiting without allowing another draw',()=>expect(restoreRoundScreen('drawing',true,true)).toBe('lobby'))
  it('rejoin during results restores the results screen',()=>expect(restoreRoundScreen('results',true,true)).toBe('result'))
  it('an original unsubmitted participant rejoins the drawing screen',()=>expect(restoreRoundScreen('drawing',true,false)).toBe('draw'))
})
