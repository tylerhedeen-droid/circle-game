import type { LocalSession } from './sessions'
export function sharedRoomCode(url:string){return new URL(url).searchParams.get('room')?.trim().toUpperCase()||null}
export function sharedRoomUrl(url:string,roomCode:string){const next=new URL(url);next.searchParams.set('room',roomCode);return next.toString()}
export function identityForRoom(roomId:string,sessions:Record<string,LocalSession>,identities:Record<string,LocalSession>){return sessions[roomId]||identities[roomId]||null}
