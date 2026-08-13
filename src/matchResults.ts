import type{Attempt,Player,Room}from'./supabase'
export type MatchStanding={player:Player;roundWins:number;average:number;best:number;played:number;rank:number;tied:boolean}
export function finalMatchStandings(attempts:Attempt[],players:Player[]):MatchStanding[]{
  const wins=new Map<string,number>()
  for(const round of new Set(attempts.map(a=>a.round_number))){const rows=attempts.filter(a=>a.round_number===round);if(!rows.length)continue;const high=Math.max(...rows.map(a=>a.score));rows.filter(a=>a.score===high).forEach(a=>wins.set(a.player_id,(wins.get(a.player_id)||0)+1))}
  const rows=players.map(player=>{const own=attempts.filter(a=>a.player_id===player.id);return own.length?{player,roundWins:wins.get(player.id)||0,average:own.reduce((s,a)=>s+a.score,0)/own.length,best:Math.max(...own.map(a=>a.score)),played:own.length,rank:0,tied:false}:null}).filter(Boolean) as MatchStanding[]
  rows.sort((a,b)=>b.roundWins-a.roundWins||b.average-a.average||b.best-a.best)
  rows.forEach((row,i)=>{const previous=rows[i-1];row.rank=previous&&previous.roundWins===row.roundWins&&previous.average===row.average&&previous.best===row.best?previous.rank:i+1;row.tied=rows.some(other=>other!==row&&other.roundWins===row.roundWins&&other.average===row.average&&other.best===row.best)})
  return rows
}
export function isFinalMatch(room:Pick<Room,'match_status'>){return room.match_status==='finished'}
export function mayStartNextRound(room:Pick<Room,'match_status'|'is_extended'|'current_round'|'match_length'>){return room.match_status==='active'&&(room.is_extended||room.current_round<room.match_length)}
