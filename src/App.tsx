import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Attempt, Player, Room, RoundParticipant, isSupabaseReady, messageFor, supabase } from './supabase'
import { Point, ScoreResult, ratingFor, scoreStroke } from './scoring'
import { resultFrameTransform } from './resultFrame'
import { LocalSession, readSessions, removeSession, saveSession } from './sessions'
import { SubmissionAlertTracker } from './submissionAlerts'
import { restoreRoundScreen } from './roundLifecycle'

type Screen = 'home'|'form'|'lobby'|'draw'|'result'|'session'
type ActiveGame = { session:LocalSession; room:Room; playerCount:number }
const BEST_KEY='circle-solo-best-v1'
const makeCode=()=>Array.from({length:5},()=> 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random()*32)]).join('')
const simplify=(pts:Point[])=>pts.filter((_,i)=>i%Math.max(1,Math.ceil(pts.length/90))===0).map(p=>({x:+p.x.toFixed(1),y:+p.y.toFixed(1)}))

function Mark({small=false}:{small?:boolean}){return <div className={`mark ${small?'small':''}`} aria-hidden="true"><i/></div>}

function DrawPad({onDone,preview}:{onDone?:(points:Point[],r:ScoreResult)=>void;preview?:{points:Point[];score:ScoreResult}}){
  const canvas=useRef<HTMLCanvasElement>(null), drawing=useRef(false), points=useRef<Point[]>([])
  const render=useCallback((stroke:Point[],fit?:ScoreResult)=>{
    const c=canvas.current;if(!c)return
    const d=devicePixelRatio||1,rect=c.getBoundingClientRect()
    if(c.width!==rect.width*d||c.height!==rect.height*d){c.width=rect.width*d;c.height=rect.height*d}
    const x=c.getContext('2d')!;x.setTransform(d,0,0,d,0,0);x.clearRect(0,0,rect.width,rect.height);x.lineJoin='round';x.lineCap='round'
    if(preview&&fit?.valid){const f=resultFrameTransform(stroke,fit,rect.width,rect.height);x.save();x.setTransform(d*f.scale,0,0,d*f.scale,d*f.offsetX,d*f.offsetY)}
    x.lineWidth=7;x.strokeStyle='#171717'
    if(stroke.length){x.beginPath();x.moveTo(stroke[0].x,stroke[0].y);stroke.slice(1).forEach(p=>x.lineTo(p.x,p.y));x.stroke()}
    if(fit?.valid){x.beginPath();x.arc(fit.center.x,fit.center.y,fit.radius,0,Math.PI*2);x.setLineDash([7,7]);x.lineWidth=2;x.strokeStyle='#ff694f';x.stroke();x.setLineDash([])}
    if(preview&&fit?.valid)x.restore()
  },[preview])
  useEffect(()=>{if(preview)render(preview.points,preview.score)},[preview,render])
  useEffect(()=>{const redraw=()=>preview&&render(preview.points,preview.score);addEventListener('resize',redraw);return()=>removeEventListener('resize',redraw)},[preview,render])
  const pos=(e:React.PointerEvent)=>{const r=canvas.current!.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top,t:performance.now()}}
  return <canvas ref={canvas} className="draw-pad" aria-label="Circle drawing area"
    onPointerDown={e=>{if(preview)return;drawing.current=true;points.current=[pos(e)];e.currentTarget.setPointerCapture(e.pointerId);render(points.current)}}
    onPointerMove={e=>{if(!drawing.current)return;const p=pos(e),last=points.current.at(-1)!;if(Math.hypot(p.x-last.x,p.y-last.y)>1.5){points.current.push(p);render(points.current)}}}
    onPointerUp={()=>{if(!drawing.current)return;drawing.current=false;const r=scoreStroke(points.current);render(points.current,r);onDone?.(points.current,r)}}
    onPointerCancel={()=>{drawing.current=false}}/>
}

export default function App(){
  const [screen,setScreen]=useState<Screen>('home'),[mode,setMode]=useState<'solo'|'create'|'join'>('solo')
  const [name,setName]=useState(''),[roomInput,setRoomInput]=useState(''),[room,setRoom]=useState<Room|null>(null),[session,setSession]=useState<LocalSession|null>(null)
  const [players,setPlayers]=useState<Player[]>([]),[attempts,setAttempts]=useState<Attempt[]>([]),[participants,setParticipants]=useState<RoundParticipant[]>([]),[activeGames,setActiveGames]=useState<ActiveGame[]>([])
  const [result,setResult]=useState<{points:Point[];score:ScoreResult}|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[copied,setCopied]=useState(false)
  const [notice,setNotice]=useState(''),[applyUpdate,setApplyUpdate]=useState<null|(()=>void)>(null)
  const alertTracker=useRef(new SubmissionAlertTracker()), seedComplete=useRef(false), playersRef=useRef(players), attemptsRef=useRef(attempts)
  playersRef.current=players;attemptsRef.current=attempts
  const solo=mode==='solo'
  const roundAttempts=attempts.filter(a=>a.round_number===room?.current_round)
  const submittedIds=new Set(roundAttempts.map(a=>a.player_id))
  const activeParticipantIds=new Set(participants.filter(p=>p.round_number===room?.current_round&&p.is_active).map(p=>p.player_id))
  const standings=useMemo(()=>players.map(p=>{const all=attempts.filter(a=>a.player_id===p.id),round=all.find(a=>a.round_number===room?.current_round);return{...p,round,wins:0,avg:all.length?all.reduce((s,a)=>s+a.score,0)/all.length:0,best:all.length?Math.max(...all.map(a=>a.score)):0,played:all.length}}).sort((a,b)=>(b.round?.score||0)-(a.round?.score||0)),[players,attempts,room])
  standings.forEach(p=>p.wins=attempts.filter(a=>a.player_id===p.id&&a.score===Math.max(...attempts.filter(x=>x.round_number===a.round_number).map(x=>x.score))).length)

  const refresh=useCallback(async(s:LocalSession)=>{
    if(!supabase)return
    const [{data:r},{data:p},{data:a},{data:rp}]=await Promise.all([supabase.from('rooms').select('*').eq('id',s.roomId).single(),supabase.from('players').select('*').eq('room_id',s.roomId).eq('is_active',true).order('joined_at'),supabase.from('attempts').select('*').eq('room_id',s.roomId),supabase.from('round_participants').select('*').eq('room_id',s.roomId)])
    if(!r||r.status==='closed'){removeSession(s.roomId);setError('Game has ended.');setScreen('home');return}
    if(r.status==='drawing'){const{data:status}=await supabase.rpc('complete_circle_round',{p_room_id:s.roomId,p_round_number:r.current_round});if(status==='results')r.status='results'}
    if(r)setRoom(r);if(p)setPlayers(p);if(a)setAttempts(a);if(rp)setParticipants(rp)
    const current=(a||[]).filter(x=>x.round_number===r?.current_round)
    const included=(rp||[]).some(x=>x.round_number===r.current_round&&x.player_id===s.playerId&&x.is_active)
    const destination=restoreRoundScreen(r.status,included,current.some(x=>x.player_id===s.playerId))
    if(destination==='draw'||destination==='lobby'||destination==='result')setScreen(destination)
  },[])
  const loadActiveGames=useCallback(async()=>{
    if(!supabase)return
    const db=supabase
    const saved=Object.values(readSessions().sessions)
    const games=(await Promise.all(saved.map(async s=>{const [{data:r},{count}]=await Promise.all([db.from('rooms').select('*').eq('id',s.roomId).neq('status','closed').maybeSingle(),db.from('players').select('*',{count:'exact',head:true}).eq('room_id',s.roomId).eq('is_active',true)]);return r?{session:s,room:r,playerCount:count||0}:null}))).filter(Boolean) as ActiveGame[]
    setActiveGames(games);const ids=new Set(games.map(g=>g.room.id));saved.forEach(s=>{if(!ids.has(s.roomId))removeSession(s.roomId)})
  },[])
  useEffect(()=>{loadActiveGames()},[loadActiveGames])
  useEffect(()=>{const f=(event:Event)=>{const apply=(event as CustomEvent<()=>void>).detail;setApplyUpdate(()=>apply)};addEventListener('circle:update-ready',f);return()=>removeEventListener('circle:update-ready',f)},[])
  useEffect(()=>{
    if(!supabase||!session)return
    const db=supabase;seedComplete.current=false;alertTracker.current=new SubmissionAlertTracker()
    db.from('attempts').select('id').eq('room_id',session.roomId).then(({data})=>{alertTracker.current.seed((data||[]).map(a=>a.id));seedComplete.current=true})
    const announce=(text:string,strong=false)=>{setNotice(text);navigator.vibrate?.(strong?[70,45,70]:35);setTimeout(()=>setNotice(''),strong?3500:2600)}
    const ch=db.channel(`room:${session.roomId}`)
      .on('postgres_changes',{event:'*',schema:'public',table:'players',filter:`room_id=eq.${session.roomId}`},()=>refresh(session))
      .on('postgres_changes',{event:'*',schema:'public',table:'round_participants',filter:`room_id=eq.${session.roomId}`},()=>refresh(session))
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'attempts',filter:`room_id=eq.${session.roomId}`},payload=>{const a=payload.new as Attempt;if(!seedComplete.current||a.player_id===session.playerId||!alertTracker.current.accept(a.id))return;const who=playersRef.current.find(p=>p.id===a.player_id)?.display_name||'A player';const count=attemptsRef.current.filter(x=>x.round_number===a.round_number).length+1;const all=count>=playersRef.current.length;announce(all?'All circles are in — results ready':`${who} submitted a circle`,all)})
      .on('postgres_changes',{event:'*',schema:'public',table:'attempts',filter:`room_id=eq.${session.roomId}`},()=>refresh(session))
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'rooms',filter:`id=eq.${session.roomId}`},()=>refresh(session)).subscribe()
    return()=>{db.removeChannel(ch)}
  },[session,refresh])

  async function enter(){
    setError('');if(!name.trim())return setError('Add a display name first.');if(!isSupabaseReady)return setError('Multiplayer needs Supabase setup. Solo Practice is ready now.')
    setBusy(true)
    try{
      if(mode==='create'){
        let created:Room|null=null;for(let i=0;i<5&&!created;i++){const{data}=await supabase!.from('rooms').insert({room_code:makeCode(),status:'lobby',reveal_mode:'all_submitted'}).select().single();created=data}
        if(!created)throw Error('create');const{data:p,error:e}=await supabase!.from('players').insert({room_id:created.id,display_name:name.trim(),is_host:true}).select().single();if(e)throw e
        await supabase!.from('rooms').update({host_player_id:p.id}).eq('id',created.id);const s={roomId:created.id,roomCode:created.room_code,playerId:p.id,name:name.trim(),isHost:true};saveSession(s);setSession(s);setRoom({...created,host_player_id:p.id});setPlayers([p]);setScreen('lobby')
      }else{
        const{data:r,error:e}=await supabase!.from('rooms').select('*').eq('room_code',roomInput.trim().toUpperCase()).maybeSingle();if(e||!r)throw Error('invalid');if(r.status==='closed')throw Error('room_closed')
        const store=readSessions(),known=store.sessions[r.id]||store.identities[r.id]
        if(known){const{data:ok}=await supabase!.rpc('rejoin_circle_player',{p_room_id:r.id,p_player_id:known.playerId});if(ok){saveSession(known);setSession(known);setRoom(r);setScreen('lobby');await refresh(known);return}}
        const{data:old}=await supabase!.from('players').select('*').eq('room_id',r.id).ilike('display_name',name.trim()).maybeSingle()
        if(old){await supabase!.rpc('rejoin_circle_player',{p_room_id:r.id,p_player_id:old.id});const s={roomId:r.id,roomCode:r.room_code,playerId:old.id,name:old.display_name,isHost:old.is_host};saveSession(s);setSession(s);setRoom(r);setScreen('lobby');await refresh(s);return}
        const{data:p,error:pe}=await supabase!.from('players').insert({room_id:r.id,display_name:name.trim(),is_host:false,is_active:true}).select().single();if(pe)throw pe
        const s={roomId:r.id,roomCode:r.room_code,playerId:p.id,name:name.trim(),isHost:false};saveSession(s);setSession(s);setRoom(r);setScreen('lobby');await refresh(s)
      }
    }catch(e){setError(/room_closed/.test(String(e))?'Game has ended.':/invalid/.test(String(e))?'That room could not be found.':messageFor(e))}finally{setBusy(false)}
  }
  const home=()=>{setScreen('home');setSession(null);setRoom(null);setPlayers([]);setAttempts([]);setResult(null);setError('');loadActiveGames()}
  const openGame=async(g:ActiveGame)=>{setSession(g.session);setRoom(g.room);setScreen('lobby');await refresh(g.session)}
  const forget=(id:string)=>{removeSession(id);setActiveGames(g=>g.filter(x=>x.room.id!==id))}
  async function startRound(){if(!room||!session)return;const{error:e}=await supabase!.rpc('start_circle_round',{p_room_id:room.id,p_host_player_id:session.playerId});if(e){setError('Could not start the round.');return}setResult(null);await refresh(session)}
  async function submit(points:Point[],score:ScoreResult){setResult({points,score});if(!score.valid)return;if(solo){setScreen('result');localStorage.setItem(BEST_KEY,String(Math.max(score.score,Number(localStorage.getItem(BEST_KEY)||0))));return}if(!room||!session)return;const{error:e}=await supabase!.from('attempts').insert({room_id:room.id,player_id:session.playerId,round_number:room.current_round,score:score.score,rating:ratingFor(score.score),points:simplify(points),radial_error:score.radialError,closure_error:score.closureRatio,smoothness_score:score.smoothness,angular_coverage:score.angularCoverage});if(e){setError(/unique|duplicate/i.test(e.message)?'You already submitted this round.':'Your circle could not be submitted.');await refresh(session);return}await supabase!.rpc('complete_circle_round',{p_room_id:room.id,p_round_number:room.current_round});await refresh(session)}
  async function removePlayer(playerId:string){if(!room||!session)return;await supabase!.rpc('remove_circle_player',{p_room_id:room.id,p_host_player_id:session.playerId,p_player_id:playerId});await refresh(session)}
  const share=async()=>{if(!session)return;const text=`Join my Circle game! Room: ${session.roomCode}`;if(navigator.share)await navigator.share({title:'Circle',text,url:location.href});else{await navigator.clipboard.writeText(session.roomCode);setCopied(true);setTimeout(()=>setCopied(false),1500)}}
  const updateControl=applyUpdate&&screen!=='draw'?<button className="update-pill" onClick={applyUpdate}>Update available — Refresh</button>:null

  if(screen==='home')return <main className="home"><header><Mark/><span className="eyebrow">A very serious game</span><h1>CIRCLE<span>.</span></h1><p>Draw one. Find out how round you really are.</p></header>{activeGames.length>0&&<section className="active-games"><span className="eyebrow">Active games</span>{activeGames.map(g=><div className="active-game" key={g.room.id}><span><strong>{g.room.room_code}</strong><small>{g.playerCount} players · {g.room.status==='lobby'?'Waiting':`Round ${g.room.current_round}`}</small></span><button onClick={()=>openGame(g)}>Open</button><button className="remove" aria-label={`Remove ${g.room.room_code}`} onClick={()=>forget(g.room.id)}>×</button></div>)}</section>}<div className="home-actions"><button className="primary" onClick={()=>{setMode('create');setScreen('form')}}>Create game <b>↗</b></button><button onClick={()=>{setMode('join');setScreen('form')}}>Join game <b>→</b></button><button className="ghost" onClick={()=>{setMode('solo');setScreen('draw')}}>Solo practice <b>◎</b></button></div><footer>No sign-up. No geometry degree. · v{__APP_VERSION__}</footer>{updateControl}</main>
  if(screen==='form')return <main className="panel"><button className="back" onClick={home}>← Back</button><Mark small/><span className="eyebrow">{mode==='create'?'Call the meeting':'Enter the arena'}</span><h2>{mode==='create'?'Create a game':'Join a game'}</h2><label>Your name<input autoFocus maxLength={24} value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Maya"/></label>{mode==='join'&&<label>Room code<input className="code-input" maxLength={5} value={roomInput} onChange={e=>setRoomInput(e.target.value.toUpperCase())} placeholder="ABCDE"/></label>}<p className="error" role="alert">{error}</p><button className="primary" disabled={busy} onClick={enter}>{busy?'One moment…':mode==='create'?'Create room':'Join room'} <b>→</b></button>{updateControl}</main>
  if(screen==='lobby'&&room&&session)return <main className="panel lobby"><div className="top"><button className="back" onClick={home}>← Home</button><button className="text-btn" onClick={()=>setScreen('session')}>Session stats</button></div><span className="eyebrow">Room code</span><h2 className="room-code">{room.room_code}</h2><button className="share" onClick={share}>{copied?'Copied!':'Share game'} <b>↗</b></button>{session.isHost&&<div className="reveal"><span>Reveal scores</span><button aria-pressed={room.reveal_mode==='all_submitted'} onClick={async()=>{const v=room.reveal_mode==='all_submitted'?'immediate':'all_submitted';setRoom({...room,reveal_mode:v});await supabase!.from('rooms').update({reveal_mode:v}).eq('id',room.id)}}><i/>{room.reveal_mode==='all_submitted'?'When everyone finishes':'As players finish'}</button></div>}<section><div className="section-title"><h3>Players</h3><span>{submittedIds.size}/{activeParticipantIds.size||players.length} submitted</span></div><ul className="players">{players.map(p=>{const submitted=submittedIds.has(p.id),included=activeParticipantIds.has(p.id);return <li key={p.id}><span className="avatar">{p.display_name[0].toUpperCase()}</span><strong>{p.display_name}{p.id===session.playerId?' (you)':''}</strong>{p.is_host&&<em>Host</em>}<span className={submitted?'submitted':'drawing'}>{room.status==='lobby'?'Ready':!included?'Next round':submitted?'Submitted ✓':'Drawing…'}</span>{session.isHost&&!p.is_host&&<button className="kick" aria-label={`Remove ${p.display_name}`} onClick={()=>removePlayer(p.id)}>Remove</button>}</li>})}</ul></section>{room.status==='lobby'&&(session.isHost?<button className="primary dock" onClick={startRound}>Start round {room.current_round+1} <b>→</b></button>:<p className="waiting">Waiting for the host to start…</p>)}{room.status==='drawing'&&<p className="waiting">{submittedIds.has(session.playerId)?'Circle submitted. Waiting for the others…':activeParticipantIds.has(session.playerId)?'Your turn is still active.':'This round is underway. You’ll join the next one.'}</p>}{error&&<p className="error" role="alert">{error}</p>}{notice&&<div className="game-notice" role="status">{notice}</div>}{updateControl}</main>
  if(screen==='draw')return <main className="game"><div className="game-head"><button className="back" onClick={solo?home:()=>setScreen('lobby')}>×</button><span>{solo?'Solo practice':`Round ${room?.current_round}`}</span><span className="dot">● LIVE</span></div><h2>Draw one circle.</h2><p>One stroke. No do-overs.</p><DrawPad onDone={submit}/>{result&&!result.score.valid&&<div className="toast" role="alert">{result.score.reason}<button onClick={()=>setResult(null)}>Try again</button></div>}<div className="tip"><b>TIP</b> Slow and steady beats fast and wobbly.</div>{notice&&<div className="game-notice dark" role="status">{notice}</div>}</main>
  if(screen==='result'&&!result)return <main className="result"><div className="game-head"><button className="back" onClick={home}>×</button><span>Round {room?.current_round}</span><span/></div><span className="eyebrow">Results ready</span><h2>All circles are in.</h2><Leaderboard standings={standings} hidden={false}/>{session?.isHost&&<button className="primary" onClick={startRound}>Next round <b>→</b></button>}{updateControl}</main>
  if(screen==='result'&&result){const s=result.score;return <main className="result"><div className="game-head"><button className="back" onClick={home}>×</button><span>{solo?'Solo result':`Round ${room?.current_round}`}</span><span/></div><span className="eyebrow">Your circle</span><DrawPad preview={result}/><div className="score"><span>ROUNDNESS</span><strong>{s.score.toFixed(1)}</strong><small>/ 100</small><h2>{ratingFor(s.score)}</h2></div>{import.meta.env.DEV&&<details><summary>Scoring diagnostics · v{__APP_VERSION__}</summary><pre>{JSON.stringify({center:s.center,radius:s.radius,radialStdDev:s.radialStdDev,radialError:s.radialError,closureRatio:s.closureRatio,closureScore:s.closureScore,smoothness:s.smoothness,angularCoverage:s.angularCoverage,coverageScore:s.coverageScore,retracePenalty:s.retracePenalty,final:s.score},null,2)}</pre></details>}{solo?<div className="result-actions"><button className="primary" onClick={()=>{setResult(null);setScreen('draw')}}>Try again <b>↻</b></button><p>Personal best: <strong>{Math.max(s.score,Number(localStorage.getItem(BEST_KEY)||0)).toFixed(1)}</strong></p></div>:<><Leaderboard standings={standings} hidden={room?.status!=='results'&&room?.reveal_mode==='all_submitted'}/>{session?.isHost&&room?.status==='results'&&<button className="primary" onClick={startRound}>Next round <b>→</b></button>}</>}{notice&&<div className="game-notice" role="status">{notice}</div>}{updateControl}</main>}
  if(screen==='session')return <main className="panel"><button className="back" onClick={()=>setScreen('lobby')}>← Lobby</button><span className="eyebrow">This room</span><h2>Session stats</h2><div className="stats-head"><b>{room?.current_round||0}</b><span>Rounds played</span></div><ul className="stats">{standings.sort((a,b)=>b.wins-a.wins||b.avg-a.avg).map((p,i)=><li key={p.id}><b>{i+1}</b><span><strong>{p.display_name}</strong><small>{p.played} played · {p.wins} wins</small></span><em>{p.avg.toFixed(1)} avg<br/>{p.best.toFixed(1)} best</em></li>)}</ul>{updateControl}</main>
  return null
}

function Leaderboard({standings,hidden}:{standings:any[];hidden:boolean}){return <section className="leader"><div className="section-title"><h3>Leaderboard</h3><span>{hidden?'Scores hidden':'Round results'}</span></div>{hidden?<p className="waiting">Waiting for everyone to finish…</p>:<ol>{standings.filter(p=>p.round).map((p,i)=><li className={i===0?'winner':''} key={p.id}><b>{i+1}</b><span><strong>{p.display_name}</strong><small>{ratingFor(p.round.score)}</small></span><em>{p.round.score.toFixed(1)}</em></li>)}</ol>}</section>}
