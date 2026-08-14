import{describe,expect,it}from'vitest'
import{markRoundViewed,smartRoomView,unseenCompletedRound}from'./unseenResults'
import type{Room}from'./supabase'
const room=(id='room',completed=1):Room=>({id,room_code:'CODE',host_player_id:'p',status:'drawing',reveal_mode:'all_submitted',current_round:completed+1,match_status:'active',match_length:3,is_extended:false,expected_player_count:2,last_completed_round:completed})
const memory=()=>{let value='';return{getItem:()=>value||null,setItem:(_:string,v:string)=>{value=v}}}
describe('locally persisted unseen results',()=>{
 it('finds a new result and viewing it survives a reopen',()=>{const s=memory(),attempts=[{round_number:1}];expect(unseenCompletedRound(room(), 'p',attempts,s)).toBe(1);markRoundViewed('room','p',1,s);expect(smartRoomView(room(),'p',attempts,s)).toEqual({view:'game'})})
 it('later rounds become unseen',()=>{const s=memory();markRoundViewed('room','p',1,s);expect(unseenCompletedRound(room('room',2),'p',[{round_number:1},{round_number:2}],s)).toBe(2)})
 it('keeps rooms and players isolated',()=>{const s=memory();markRoundViewed('one','p',1,s);expect(unseenCompletedRound(room('two'),'p',[{round_number:1}],s)).toBe(1);expect(unseenCompletedRound(room('one'),'other',[{round_number:1}],s)).toBe(1)})
 it('prioritizes unseen results before final results',()=>{const s=memory(),final={...room('room',3),match_status:'finished' as const};expect(smartRoomView(final,'p',[1,2,3].map(round_number=>({round_number})),s)).toEqual({view:'results',round:1});[1,2,3].forEach(r=>markRoundViewed('room','p',r,s));expect(smartRoomView(final,'p',[],s)).toEqual({view:'full'})})
 it('handles extended Round 4+ generically',()=>{const s=memory();[1,2,3,4].forEach(r=>markRoundViewed('room','p',r,s));expect(smartRoomView(room('room',4),'p',[1,2,3,4].map(round_number=>({round_number})),s)).toEqual({view:'game'})})
})
