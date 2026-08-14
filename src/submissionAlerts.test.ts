import {describe,expect,it} from 'vitest'
import {noticesFromSnapshot,noticeText,RealtimeNoticeTracker,snapshotKeys} from './submissionAlerts'
import type{Attempt,Player,Room}from'./supabase'
const room=(round=1,complete=0):Room=>({id:'r',room_code:'ABCDE',host_player_id:'me',status:'drawing',reveal_mode:'all_submitted',current_round:round,match_status:'active',match_length:3,is_extended:round>3,expected_player_count:2,last_completed_round:complete})
const player=(id:string,name:string):Player=>({id,room_id:'r',display_name:name,is_host:id==='me',is_active:true,joined_at:''})
const attempt=(id:string,p:string,r:number):Attempt=>({id,room_id:'r',player_id:p,round_number:r,score:90,rating:'Great',points:[],radial_error:0,closure_error:0,smoothness_score:1,angular_coverage:1,created_at:''})
describe('authoritative in-app activity alerts',()=>{
 it('detects a join and another player submission but not my own',()=>{const before={room:room(),players:[player('me','Me')],attempts:[]};const after={room:room(),players:[...before.players,player('m','Mike')],attempts:[attempt('own','me',1),attempt('a','m',1)]};expect(noticesFromSnapshot(before,after,'me').map(noticeText)).toEqual(['Mike joined the game','Mike submitted Round 1'])})
 it.each([1,2,3,4])('detects Round %s completion',r=>{const events=noticesFromSnapshot({room:room(r,r-1),players:[],attempts:[]},{room:{...room(r,r),status:'results'},players:[],attempts:[]},'me');expect(noticeText(events[0])).toContain(`Round ${r} complete`)})
 it.each([3,4,5])('detects generic Round %s readiness',r=>{const events=noticesFromSnapshot({room:room(r-1,r-1),players:[],attempts:[]},{room:room(r,r-1),players:[],attempts:[]},'me');expect(noticeText(events[0])).toBe(`Round ${r} is ready — your turn`)})
 it('seeds stale history and semantically deduplicates reconnects',()=>{const t=new RealtimeNoticeTracker();t.seed(snapshotKeys(room(5,4),[player('m','Mike')],[attempt('a','m',4)]));const event={kind:'round_ready',round:5} as const;expect(t.accept(event)).toBe(false);const fresh={kind:'round_submitted',attemptId:'new',playerName:'Mike',round:5} as const;expect(t.accept(fresh)).toBe(true);expect(t.accept(fresh)).toBe(false)})
})
