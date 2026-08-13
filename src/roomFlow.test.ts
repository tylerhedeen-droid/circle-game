import{describe,expect,it}from'vitest'
import{canStartCompetitiveRound,createdRoomState,homeNavigationPreservesRoom}from'./roomFlow'
import{resolveMultiplayerState,startRound,submitAttempt}from'./roundLifecycle'
describe('competitive room flow',()=>{
  it('creates a real lobby with no participant snapshot',()=>expect(createdRoomState()).toEqual({status:'lobby',currentRound:0,participantIds:[]}))
  it('keeps the host out of drawing before Start Round',()=>expect(resolveMultiplayerState({room:{id:'r',room_code:'ABCDE',status:'lobby',current_round:0},playerId:'h',participant:null,attempt:null})).toBe('lobby'))
  it('disables a one-player lobby',()=>expect(canStartCompetitiveRound({status:'lobby'},1,true)).toBe(false))
  it('enables a two-player host lobby',()=>expect(canStartCompetitiveRound({status:'lobby'},2,true)).toBe(true))
  it('starts Round 1 with both players drawing',()=>{const state=startRound(['h','g']);expect([...state.participants]).toEqual(['h','g']);for(const id of ['h','g'])expect(resolveMultiplayerState({room:{id:'r',room_code:'ABCDE',status:'drawing',current_round:1},playerId:id,participant:{player_id:id,round_number:1,is_active:true},attempt:null})).toBe('draw')})
  it.each(['lobby','drawing','results'])('Home from %s preserves the room/session',()=>expect(homeNavigationPreservesRoom()).toBe(true))
  it('reopening after Home restores results',()=>expect(resolveMultiplayerState({room:{id:'r',room_code:'ABCDE',status:'results',current_round:1},playerId:'h',participant:{player_id:'h',round_number:1,is_active:true},attempt:{player_id:'h',round_number:1}})).toBe('results'))
  it('only the host can begin the next round after results',()=>{expect(canStartCompetitiveRound({status:'results'},2,false)).toBe(false);expect(canStartCompetitiveRound({status:'results'},2,true)).toBe(true)})
  it('next round resets submissions while prior state remains intact',()=>{const first=startRound(['h','g']);submitAttempt(first,'h');submitAttempt(first,'g');const second=startRound(['h','g']);expect(first.status).toBe('results');expect(second.status).toBe('drawing');expect(second.submitted.size).toBe(0)})
})
