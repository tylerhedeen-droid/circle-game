import{describe,expect,it}from'vitest'
import{activeGameStatus,canChangeExpectedPlayerCount,homeNavigationPreservesRoom,validExpectedPlayerCount}from'./roomFlow'
const room={status:'drawing' as const,current_round:1,expected_player_count:4,match_status:'active' as const,last_completed_round:0}
describe('async room flow',()=>{
 it.each([2,4,10])('accepts supported player count %s',n=>expect(validExpectedPlayerCount(n)).toBe(true))
 it.each([1,11,2.5])('rejects invalid player count %s',n=>expect(validExpectedPlayerCount(n)).toBe(false))
 it('allows decreases no lower than active roster',()=>{expect(canChangeExpectedPlayerCount(room,3,3,3,4)).toBe(true);expect(canChangeExpectedPlayerCount(room,3,3,2,4)).toBe(false)})
 it('allows increases only before Round 1 submissions',()=>{expect(canChangeExpectedPlayerCount(room,2,0,5,4)).toBe(true);expect(canChangeExpectedPlayerCount(room,2,1,5,4)).toBe(false)})
 it('formats multi-room attention states',()=>{expect(activeGameStatus(room,3,true)).toBe('Round 1 · 3/4 players · You submitted');expect(activeGameStatus(room,3,false)).toBe('Round 1 · Your turn');expect(activeGameStatus({...room,match_status:'finished'},4,true)).toBe('Game complete')})
 it('preserves sessions on Home/PWA reopen',()=>expect(homeNavigationPreservesRoom()).toBe(true))
})
