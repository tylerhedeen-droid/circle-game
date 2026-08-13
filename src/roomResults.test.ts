import{describe,expect,it}from'vitest'
import{mayRevealCurrent,rankedRound,restoredRoomView,roundHistory,sessionRows}from'./roomResults'
import type{Attempt,Player,Room}from'./supabase'
const players=[{id:'a',display_name:'Tyler'},{id:'b',display_name:'Mike'}] as Player[]
const attempt=(id:string,player:string,round:number,score:number)=>({id,player_id:player,room_id:'r',round_number:round,score,rating:'Respectable',points:[],radial_error:0,closure_error:0,smoothness_score:1,angular_coverage:1,created_at:`2026-01-0${round}T00:00:00Z`}) as Attempt
const attempts=[attempt('1','a',1,80),attempt('2','b',1,90),attempt('3','a',2,92),attempt('4','b',2,85)]
describe('persistent room results',()=>{
  it('shows all player scores after a completed round',()=>expect(rankedRound(attempts,players,2).map(r=>[r.playerName,r.score])).toEqual([['Tyler',92],['Mike',85]]))
  it.each(['navigation','refresh','Active Games','rejoin'])('restores results after %s',()=>expect(restoredRoomView('results')).toBe('results'))
  it('next round preserves prior attempts in history',()=>expect(roundHistory(attempts,players,3).flatMap(r=>r.results)).toHaveLength(4))
  it('orders history newest to oldest',()=>expect(roundHistory(attempts,players,3).map(r=>r.roundNumber)).toEqual([2,1]))
  it('never leaks all-submitted scores while drawing',()=>expect(mayRevealCurrent({status:'drawing',reveal_mode:'all_submitted'})).toBe(false))
  it('reveals immediate scores while drawing',()=>expect(mayRevealCurrent({status:'drawing',reveal_mode:'immediate'})).toBe(true))
  it('keeps session stats correct across rounds',()=>{const rows=sessionRows(attempts,players);expect(rows.map(r=>({name:r.player.display_name,wins:r.wins,played:r.played,best:r.best}))).toEqual([{name:'Mike',wins:1,played:2,best:90},{name:'Tyler',wins:1,played:2,best:92}])})
})
