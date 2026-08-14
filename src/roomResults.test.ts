import{describe,expect,it}from'vitest'
import{circleResultPreview,completedResultsRound,mayRevealCurrent,rankedRound,restoredRoomView,roundHistory,sessionRows}from'./roomResults'
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
  it('never invents a zero score for a participant with no attempt',()=>{const rows=sessionRows([],players);expect(rows.every(r=>r.played===0)).toBe(true);expect(rankedRound([],players,1)).toEqual([])})
  it('omits a late nonparticipant with no attempt from round standings',()=>expect(rankedRound([attempt('1','a',1,88)],players,1).map(r=>r.playerName)).toEqual(['Tyler']))
  it('displays the exact persisted score, including a real zero',()=>expect(rankedRound([attempt('z','a',1,0)],players,1)[0].score).toBe(0))
  it('averages only persisted attempts',()=>expect(sessionRows([attempt('1','a',1,88)],players).find(r=>r.player.id==='a')?.average).toBe(88))
})

describe('completed-round comparison cards',()=>{
  it('associates results with last_completed_round after the next round opens',()=>expect(completedResultsRound({status:'drawing',current_round:4,last_completed_round:3})).toBe(3))
  it('uses stored points and persisted score for the circle preview',()=>{const a=attempt('preview','a',3,91);a.points=Array.from({length:65},(_,i)=>{const angle=i/64*Math.PI*2;return{x:100+80*Math.cos(angle),y:100+80*Math.sin(angle),t:i*16}});const preview=circleResultPreview(a);expect(preview.points).toBe(a.points);expect(preview.score.score).toBe(91);expect(preview.score.center.x).toBeCloseTo(100)})
  it.each(['refresh','reopen'])('keeps the completed round on %s',()=>expect(completedResultsRound({status:'drawing',current_round:3,last_completed_round:2})).toBe(2))
})
