import type {Attempt,Player,Room,RoundParticipant} from './supabase'
export const MIN_EXPECTED_PLAYERS=2,MAX_EXPECTED_PLAYERS=10
export const validExpectedPlayerCount=(count:number)=>Number.isInteger(count)&&count>=MIN_EXPECTED_PLAYERS&&count<=MAX_EXPECTED_PLAYERS
export function canChangeExpectedPlayerCount(room:Pick<Room,'current_round'>,active:number,attempts:number,next:number,current:number){return validExpectedPlayerCount(next)&&next>=active&&(next<current||(next>current&&room.current_round===1&&attempts===0))}

export type RoomAttention={title:string;detail:string;compact:string}
export function roomAttention(room:Room,players:Player[],attempts:Attempt[],myId:string,participants:RoundParticipant[]=[]):RoomAttention{
  const round=room.current_round,current=attempts.filter(a=>a.round_number===round),mine=current.some(a=>a.player_id===myId)
  const eligible=new Set(participants.filter(p=>p.round_number===round&&p.is_active).map(p=>p.player_id));const roster=eligible.size?players.filter(p=>eligible.has(p.id)):players
  const outstanding=roster.filter(p=>!current.some(a=>a.player_id===p.id)&&p.id!==myId).map(p=>p.display_name)
  if(room.match_status==='finished'||room.status==='closed')return{title:'Match complete',detail:'Final results ready',compact:'Final results ready'}
  if(room.status==='results'||room.last_completed_round===round)return{title:`Round ${round} complete`,detail:'Results ready',compact:`Round ${round} · Results ready`}
  if(players.length<room.expected_player_count)return{title:`${players.length} / ${room.expected_player_count} joined`,detail:mine?`Your circle is submitted · Waiting for ${room.expected_player_count-players.length} more player${room.expected_player_count-players.length===1?'':'s'}`:`Waiting for ${room.expected_player_count-players.length} more player${room.expected_player_count-players.length===1?'':'s'}`,compact:`Round ${round} · Waiting for player${mine?' · You submitted':''}`}
  if(mine){const names=outstanding.join(', ');return{title:`Round ${round}`,detail:names?`You submitted · Waiting for ${names}`:'You submitted',compact:`Round ${round} · You submitted${names?` · Waiting for ${names}`:''}`}}
  return{title:`Round ${round}${round>1?' ready':''}`,detail:'Your turn · Draw your circle when you’re ready',compact:`Round ${round} · Your turn`}
}
export function activeGameStatus(room:Room,players:Player[],attempts:Attempt[],myId:string,participants:RoundParticipant[]=[]){return roomAttention(room,players,attempts,myId,participants).compact}
export function homeNavigationPreservesRoom(){return true}
