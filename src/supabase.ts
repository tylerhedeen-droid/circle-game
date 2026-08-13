import { createClient } from '@supabase/supabase-js'
const url=import.meta.env.VITE_SUPABASE_URL as string|undefined
const key=import.meta.env.VITE_SUPABASE_ANON_KEY as string|undefined
export const isSupabaseReady=Boolean(url&&key)
export const supabase=isSupabaseReady?createClient(url!,key!,{auth:{persistSession:false}}):null

export type Room={id:string;room_code:string;host_player_id:string|null;status:'lobby'|'drawing'|'results'|'closed';reveal_mode:'immediate'|'all_submitted';current_round:number;match_status:'active'|'finished';match_length:number;is_extended:boolean}
export type Player={id:string;room_id:string;display_name:string;is_host:boolean;is_active:boolean;joined_at:string}
export type RoundParticipant={room_id:string;round_number:number;player_id:string;is_active:boolean}
export type Attempt={id:string;room_id:string;player_id:string;round_number:number;score:number;rating:string;points:{x:number;y:number}[];radial_error:number;closure_error:number;smoothness_score:number;angular_coverage:number;created_at:string}

export const messageFor=(e:unknown,fallback='Something went wrong. Please try again.')=>{
  const m=e instanceof Error?e.message:String(e)
  if(/duplicate|unique/i.test(m))return 'That name or room code is already in use.'
  if(/network|fetch/i.test(m))return 'We could not reach the game server. Check your connection.'
  return fallback
}
