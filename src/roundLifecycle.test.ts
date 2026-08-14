import{describe,expect,it}from'vitest'
import{isDrawableLifecycle,joinAsyncRound,openAsyncRound,reduceExpectedPlayers,removeAsyncPlayer,resolveMultiplayerState,submitAsyncAttempt}from'./roundLifecycle'

describe('asynchronous expected-player lifecycle',()=>{
  it('keeps a 2-player game open when host submits before friend joins',()=>{const s=openAsyncRound(2,['host']);submitAsyncAttempt(s,'host');expect(s.status).toBe('drawing');joinAsyncRound(s,'friend');expect(s.status).toBe('drawing');submitAsyncAttempt(s,'friend');expect(s.status).toBe('results')})
  it('waits for 4/4 joined and 4/4 submitted',()=>{const s=openAsyncRound(4,['a']);submitAsyncAttempt(s,'a');for(const id of ['b','c']){joinAsyncRound(s,id);submitAsyncAttempt(s,id)}expect(s.status).toBe('drawing');joinAsyncRound(s,'d');expect(s.status).toBe('drawing');submitAsyncAttempt(s,'d');expect(s.status).toBe('results')})
  it('does not finish when all currently joined submit but a slot remains',()=>{const s=openAsyncRound(4,['a','b']);submitAsyncAttempt(s,'a');submitAsyncAttempt(s,'b');expect(s.status).toBe('drawing')})
  it('reducing 4 to 3 completes when all three already submitted',()=>{const s=openAsyncRound(4,['a','b','c']);for(const id of s.activePlayers)submitAsyncAttempt(s,id);reduceExpectedPlayers(s,3);expect(s.status).toBe('results')})
  it('cannot reduce below active players',()=>expect(()=>reduceExpectedPlayers(openAsyncRound(4,['a','b','c']),2)).toThrow())
  it('does not silently exceed capacity',()=>{const s=openAsyncRound(2,['a','b']);joinAsyncRound(s,'c');expect(s.activePlayers.has('c')).toBe(false)})
  it('enforces one attempt per player per round',()=>{const s=openAsyncRound(2,['a','b']);submitAsyncAttempt(s,'a');submitAsyncAttempt(s,'a');expect(s.submitted.size).toBe(1);expect(s.transitionCount).toBe(0)})
  it('removal frees a slot but does not reduce expected count',()=>{const s=openAsyncRound(3,['a','b','c']);submitAsyncAttempt(s,'a');submitAsyncAttempt(s,'b');removeAsyncPlayer(s,'c');expect(s.expectedPlayerCount).toBe(3);expect(s.status).toBe('drawing')})
  it('opens an independent next round without altering history state',()=>{const first=openAsyncRound(2,['a','b']);submitAsyncAttempt(first,'a');submitAsyncAttempt(first,'b');const second=openAsyncRound(2,['a','b']);submitAsyncAttempt(second,'a');expect(first.status).toBe('results');expect(second.status).toBe('drawing')})
})

describe('authoritative resolver',()=>{
 const resolve=(attempt:boolean,active=2,submitted=attempt?1:0,round=1,last=0)=>resolveMultiplayerState({room:{id:'r',room_code:'ABCDE',status:'drawing',current_round:round,expected_player_count:2,last_completed_round:last,match_status:'active'},playerId:'a',participant:{player_id:'a',round_number:round,is_active:true},attempt:attempt?{player_id:'a',round_number:round}:null,activePlayerCount:active,submittedCount:submitted})
 it('restores a submitted host waiting for players',()=>expect(resolve(true,1,1)).toBe('submitted_waiting_players'))
 it('restores a submitted player waiting for attempts',()=>expect(resolve(true,2,1)).toBe('submitted_waiting_attempts'))
 it('restores refresh/PWA/shared-link state from rows',()=>expect(resolve(true,2,1)).toBe('submitted_waiting_attempts'))
 it('announces an automatically prepared next round',()=>expect(resolve(false,2,0,2,1)).toBe('next_round_ready'))
 it('allows the Round 2 drawing screen for next_round_ready',()=>expect(isDrawableLifecycle(resolve(false,2,0,2,1))).toBe(true))
 it.each([2,3,4])('allows automatically prepared Round %s without a loading deadlock',round=>expect(isDrawableLifecycle(resolve(false,2,0,round,round-1))).toBe(true))
 it('does not treat waiting or loading as drawable',()=>{expect(isDrawableLifecycle('submitted_waiting_attempts')).toBe(false);expect(isDrawableLifecycle('loading')).toBe(false)})
 it('resolves final results authoritatively',()=>expect(resolveMultiplayerState({room:{id:'r',room_code:'ABCDE',status:'results',current_round:3,expected_player_count:2,match_status:'finished'},playerId:'a',participant:null,attempt:null,activePlayerCount:2,submittedCount:2})).toBe('final_results'))
})
