import {describe,expect,it} from 'vitest'
import {readSessions,removeSession,saveSession,pruneSessions,SESSIONS_KEY} from './sessions'
const memory=()=>{const data:Record<string,string>={};return{getItem:(k:string)=>data[k]??null,setItem:(k:string,v:string)=>{data[k]=v},data}}
const a={roomId:'a',roomCode:'AAAAA',playerId:'p1',name:'Ana',isHost:true},b={roomId:'b',roomCode:'BBBBB',playerId:'p2',name:'Bo',isHost:false}
describe('multi-room sessions',()=>{
  it('stores and restores multiple sessions',()=>{const s=memory();saveSession(a,s);saveSession(b,s);expect(Object.values(readSessions(s).sessions)).toEqual([a,b]);expect(JSON.parse(s.data[SESSIONS_KEY]).version).toBe(3)})
  it('switching rooms preserves both identities',()=>{const s=memory();saveSession(a,s);saveSession(b,s);expect(readSessions(s).sessions.a.playerId).toBe('p1');expect(readSessions(s).sessions.b.playerId).toBe('p2')})
  it('leaves one room without affecting another and retains rejoin identity',()=>{const s=memory();saveSession(a,s);saveSession(b,s);removeSession('a',s);const store=readSessions(s);expect(Object.keys(store.sessions)).toEqual(['b']);expect(store.identities.a).toEqual(a)})
  it('prunes closed or expired rooms',()=>{const s=memory();saveSession(a,s);saveSession(b,s);pruneSessions(new Set(['b']),s);expect(Object.keys(readSessions(s).sessions)).toEqual(['b'])})
  it('restores host identity after refresh or rejoin',()=>{const s=memory();saveSession(a,s);removeSession('a',s);saveSession(readSessions(s).identities.a,s);expect(readSessions(s).sessions.a).toMatchObject({playerId:'p1',isHost:true})})
  it('rejoins with the same player identity after submitting',()=>{const s=memory();saveSession(b,s);removeSession('b',s);expect(readSessions(s).identities.b.playerId).toBe('p2')})
})
