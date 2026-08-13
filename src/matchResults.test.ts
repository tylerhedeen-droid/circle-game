import{describe,expect,it}from'vitest'
import{finalMatchStandings,isFinalMatch,mayStartNextRound}from'./matchResults'
import type{Attempt,Player}from'./supabase'
const players=['a','b','c'].map(id=>({id,display_name:id.toUpperCase()})) as Player[]
const at=(id:string,p:string,r:number,s:number)=>({id,player_id:p,room_id:'x',round_number:r,score:s,rating:'',points:[],radial_error:0,closure_error:0,smoothness_score:1,angular_coverage:1,created_at:id})as Attempt
describe('overall match completion',()=>{
  it('continues after Round 1 and Round 2',()=>{expect(mayStartNextRound({match_status:'active',is_extended:false,current_round:1,match_length:3})).toBe(true);expect(mayStartNextRound({match_status:'active',is_extended:false,current_round:2,match_length:3})).toBe(true)})
  it('shows final results after Round 3',()=>expect(isFinalMatch({match_status:'finished'})).toBe(true))
  it('selects a 2-player winner by round wins',()=>expect(finalMatchStandings([at('1','a',1,90),at('2','b',1,80),at('3','a',2,70),at('4','b',2,85),at('5','a',3,88),at('6','b',3,87)],players.slice(0,2))[0].player.id).toBe('a'))
  it('ranks 3+ players',()=>expect(finalMatchStandings([at('1','a',1,90),at('2','b',1,80),at('3','c',1,70),at('4','b',2,91),at('5','c',3,92)],players)).toHaveLength(3))
  it('counts round wins',()=>expect(finalMatchStandings([at('1','a',1,90),at('2','b',1,80),at('3','a',2,91),at('4','b',2,85)],players.slice(0,2))[0].roundWins).toBe(2))
  it('uses average as first tiebreaker',()=>expect(finalMatchStandings([at('1','a',1,90),at('2','b',1,80),at('3','a',2,70),at('4','b',2,95)],players.slice(0,2))[0].player.id).toBe('b'))
  it('uses best score as second tiebreaker',()=>expect(finalMatchStandings([at('1','a',1,100),at('2','b',1,90),at('3','a',2,60),at('4','b',2,70)],players.slice(0,2))[0].player.id).toBe('a'))
  it('preserves an exact tie',()=>{const rows=finalMatchStandings([at('1','a',1,90),at('2','b',1,90)],players.slice(0,2));expect(rows.map(r=>r.rank)).toEqual([1,1]);expect(rows.every(r=>r.tied)).toBe(true)})
  it.each([1,2])('supports host ending after Round %s',round=>expect(isFinalMatch({match_status:'finished'})).toBe(true))
  it('Keep Playing permits Round 4',()=>expect(mayStartNextRound({match_status:'active',is_extended:true,current_round:3,match_length:3})).toBe(true))
  it('preserves extended history and ignores missing attempts',()=>{const rows=finalMatchStandings([at('1','a',1,90),at('2','a',4,80)],players);expect(rows).toHaveLength(1);expect(rows[0].played).toBe(2)})
  it('finished games remain resolvable for Active Games',()=>expect(isFinalMatch({match_status:'finished'})).toBe(true))
})
