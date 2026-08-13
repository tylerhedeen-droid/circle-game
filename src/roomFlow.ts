import type { Room } from './supabase'
export const MIN_COMPETITIVE_PLAYERS=2
export function canStartCompetitiveRound(room:Pick<Room,'status'>,activePlayerCount:number,isHost:boolean){return isHost&&room.status!=='drawing'&&room.status!=='closed'&&activePlayerCount>=MIN_COMPETITIVE_PLAYERS}
export function createdRoomState(){return{status:'lobby' as const,currentRound:0,participantIds:[] as string[]}}
export function homeNavigationPreservesRoom(){return true}
