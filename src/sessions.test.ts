import {describe,expect,it} from 'vitest'
import {readSessions,removeSession,saveSession,pruneSessions,SESSIONS_KEY} from './sessions'
const memory=()=>{const data:Record<string,string>={};return{getItem:(k:string)=>data[k]??null,setItem:(k:string,v:string)=>{data[k]=v},data}}
const a={roomId:'a',roomCode:'AAAAA',playerId:'p1',name:'Ana',isHost:true},b={roomId:'b',roomCode:'BBBBB',playerId:'p2',name:'Bo',isHost:false}
describe('multi-room sessions',()=>{
  it('stores and restores multiple sessions',()=>{const s=memory();saveSession(a,s);saveSession(b,s);expect(Object.values(readSessions(s).sessions)).toEqual([a,b]);expect(JSON.parse(s.data[SESSIONS_KEY]).version).toBe(2)})
  it('switching rooms preserves both identities',()=>{const s=memory();saveSession(a,s);saveSession(b,s);expect(readSessions(s).sessions.a.playerId).toBe('p1');expect(readSessions(s).sessions.b.playerId).toBe('p2')})
  it('removes one without affecting another',()=>{const s=memory();saveSession(a,s);saveSession(b,s);removeSession('a',s);expect(Object.keys(readSessions(s).sessions)).toEqual(['b'])})
  it('prunes closed or expired rooms',()=>{const s=memory();saveSession(a,s);saveSession(b,s);pruneSessions(new Set(['b']),s);expect(Object.keys(readSessions(s).sessions)).toEqual(['b'])})
})
