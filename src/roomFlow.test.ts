import{describe,expect,it}from'vitest'
import{activeGameStatus,canChangeExpectedPlayerCount,homeNavigationPreservesRoom,resultPrimaryAction,roomAttention,validExpectedPlayerCount}from'./roomFlow'
import type{Attempt,Player,Room}from'./supabase'
const room=(round=1):Room=>({id:'r',room_code:'CODE',host_player_id:'me',status:'drawing',reveal_mode:'all_submitted',current_round:round,match_status:'active',match_length:3,is_extended:round>3,expected_player_count:2,last_completed_round:round-1})
const p=(id:string,name:string):Player=>({id,room_id:'r',display_name:name,is_host:false,is_active:true,joined_at:''})
const a=(id:string,pid:string,r:number):Attempt=>({id,room_id:'r',player_id:pid,round_number:r,score:90,rating:'Great',points:[],radial_error:0,closure_error:0,smoothness_score:1,angular_coverage:1,created_at:''})
describe('persistent room attention',()=>{
 it.each([2,4,10])('accepts supported player count %s',n=>expect(validExpectedPlayerCount(n)).toBe(true))
 it('retains player-count rules',()=>{expect(canChangeExpectedPlayerCount(room(),1,0,2,3)).toBe(true)})
 it('shows waiting for player and own submission',()=>expect(roomAttention(room(),[p('me','Me')],[a('a','me',1)],'me').compact).toBe('Round 1 · Waiting for player · You submitted'))
 it('shows named outstanding player',()=>expect(roomAttention(room(4),[p('me','Me'),p('m','Mike')],[a('a','me',4)],'me').detail).toBe('You submitted · Waiting for Mike'))
 it.each([3,5])('shows Round %s as your turn',r=>expect(activeGameStatus(room(r),[p('me','Me'),p('m','Mike')],[],'me')).toBe(`Round ${r} · Your turn`))
 it('shows results and final results',()=>{expect(roomAttention({...room(4),status:'results',last_completed_round:4},[],[],'me').detail).toBe('Results ready');expect(roomAttention({...room(5),match_status:'finished'},[],[],'me').compact).toBe('Final results ready')})
 it.each([[1,2,'Draw Round 2'],[2,3,'Draw Round 3'],[3,4,'View Full Match Results'],[4,5,'Draw Round 5']] as const)('provides the Round %s primary action', (round,current,label)=>expect(resultPrimaryAction(round,current,3,round>3).label).toBe(label))
 it('preserves sessions on reopen',()=>expect(homeNavigationPreservesRoom()).toBe(true))
})
