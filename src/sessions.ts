export type LocalSession={roomId:string;roomCode:string;playerId:string;name:string;isHost:boolean}
export type SessionStore={version:3;sessions:Record<string,LocalSession>;identities:Record<string,LocalSession>}
export const SESSIONS_KEY='circle-sessions-v3',LEGACY_KEY='circle-sessions-v2'
const empty=():SessionStore=>({version:3,sessions:{},identities:{}})
export function readSessions(storage:Pick<Storage,'getItem'|'setItem'>=localStorage):SessionStore{
  try{
    const raw=storage.getItem(SESSIONS_KEY);if(raw){const parsed=JSON.parse(raw);if(parsed?.version===3&&parsed.sessions&&parsed.identities)return parsed}
    const legacy=storage.getItem(LEGACY_KEY);if(legacy){const old=JSON.parse(legacy);if(old?.sessions){const migrated={version:3 as const,sessions:old.sessions,identities:{...old.sessions}};storage.setItem(SESSIONS_KEY,JSON.stringify(migrated));return migrated}}
  }catch{/* Corrupt local state falls back safely. */}
  return empty()
}
export function saveSession(session:LocalSession,storage:Pick<Storage,'getItem'|'setItem'>=localStorage){const store=readSessions(storage);store.sessions[session.roomId]=session;store.identities[session.roomId]=session;storage.setItem(SESSIONS_KEY,JSON.stringify(store));return store}
/** Removes a room from Active Games but deliberately retains its server identity for rejoin. */
export function removeSession(roomId:string,storage:Pick<Storage,'getItem'|'setItem'>=localStorage){const store=readSessions(storage);delete store.sessions[roomId];storage.setItem(SESSIONS_KEY,JSON.stringify(store));return store}
export function forgetIdentity(roomId:string,storage:Pick<Storage,'getItem'|'setItem'>=localStorage){const store=readSessions(storage);delete store.sessions[roomId];delete store.identities[roomId];storage.setItem(SESSIONS_KEY,JSON.stringify(store));return store}
export function pruneSessions(activeRoomIds:Set<string>,storage:Pick<Storage,'getItem'|'setItem'>=localStorage){const store=readSessions(storage);for(const id of Object.keys(store.sessions))if(!activeRoomIds.has(id))delete store.sessions[id];storage.setItem(SESSIONS_KEY,JSON.stringify(store));return store}
