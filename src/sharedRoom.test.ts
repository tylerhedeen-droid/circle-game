import{describe,expect,it}from'vitest'
import{identityForRoom,sharedRoomCode,sharedRoomUrl}from'./sharedRoom'
const host={roomId:'r',roomCode:'ABCDE',playerId:'host',name:'Host',isHost:true}
describe('shared room restoration',()=>{
  it('puts the room code in the shared URL',()=>expect(sharedRoomUrl('https://example.test/circle-game/','ABCDE')).toBe('https://example.test/circle-game/?room=ABCDE'))
  it('recognizes a room code without manual re-entry',()=>expect(sharedRoomCode('https://example.test/circle-game/?room=abcde')).toBe('ABCDE'))
  it('restores an existing host identity instead of creating a guest',()=>expect(identityForRoom('r',{}, {r:host})).toEqual(host))
})
