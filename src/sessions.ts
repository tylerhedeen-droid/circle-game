export type LocalSession={roomId:string;roomCode:string;playerId:string;name:string;isHost:boolean}
export type SessionStore={version:2;sessions:Record<string,LocalSession>}
export const SESSIONS_KEY='circle-sessions-v2'
const empty=():SessionStore=>({version:2,sessions:{}})
export function readSessions(storage:Pick<Storage,'getItem'>=localStorage):SessionStore{
  try{const raw=storage.getItem(SESSIONS_KEY);if(!raw)return empty();const parsed=JSON.parse(raw);return parsed?.version===2&&parsed.sessions?parsed:empty()}catch{return empty()}
}
export function saveSession(session:LocalSession,storage:Pick<Storage,'getItem'|'setItem'>=localStorage){const store=readSessions(storage);store.sessions[session.roomId]=session;storage.setItem(SESSIONS_KEY,JSON.stringify(store));return store}
export function removeSession(roomId:string,storage:Pick<Storage,'getItem'|'setItem'>=localStorage){const store=readSessions(storage);delete store.sessions[roomId];storage.setItem(SESSIONS_KEY,JSON.stringify(store));return store}
export function pruneSessions(activeRoomIds:Set<string>,storage:Pick<Storage,'getItem'|'setItem'>=localStorage){const store=readSessions(storage);for(const id of Object.keys(store.sessions))if(!activeRoomIds.has(id))delete store.sessions[id];storage.setItem(SESSIONS_KEY,JSON.stringify(store));return store}
