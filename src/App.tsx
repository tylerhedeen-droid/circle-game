import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Attempt, Player, Room, RoundParticipant, isSupabaseReady, messageFor, supabase } from './supabase'
import { Point, ScoreResult, ratingFor, scoreStroke } from './scoring'
import { resultFrameTransform } from './resultFrame'
import { LocalSession, readSessions, removeSession, saveSession } from './sessions'
import { SubmissionAlertTracker } from './submissionAlerts'
import { MultiplayerLifecycle, resolveMultiplayerState } from './roundLifecycle'
import { mayRevealCurrent, rankedRound, roundHistory, sessionRows } from './roomResults'
import { identityForRoom, sharedRoomCode, sharedRoomUrl } from './sharedRoom'
import { activeGameStatus } from './roomFlow'
import { finalMatchStandings, isFinalMatch } from './matchResults'

type Screen = 'home'|'form'|'lobby'|'draw'|'result'
type RoomView='game'|'results'|'history'|'session'
type ActiveGame = { session:LocalSession; room:Room; playerCount:number; submitted:boolean }
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
  const [expectedPlayers,setExpectedPlayers]=useState(2)
  const [name,setName]=useState(''),[roomInput,setRoomInput]=useState(''),[room,setRoom]=useState<Room|null>(null),[session,setSession]=useState<LocalSession|null>(null)
  const [players,setPlayers]=useState<Player[]>([]),[attempts,setAttempts]=useState<Attempt[]>([]),[participants,setParticipants]=useState<RoundParticipant[]>([]),[activeGames,setActiveGames]=useState<ActiveGame[]>([])
  const [result,setResult]=useState<{points:Point[];score:ScoreResult}|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[copied,setCopied]=useState(false)
  const [notice,setNotice]=useState(''),[applyUpdate,setApplyUpdate]=useState<null|(()=>void)>(null)
  const [roomView,setRoomView]=useState<RoomView>('game')
  const [lifecycle,setLifecycle]=useState<MultiplayerLifecycle>('loading')
  const alertTracker=useRef(new SubmissionAlertTracker()), seedComplete=useRef(false), playersRef=useRef(players), attemptsRef=useRef(attempts),lastCompletedRef=useRef(0)
  playersRef.current=players;attemptsRef.current=attempts
  const solo=mode==='solo'&&!session
  const roundAttempts=attempts.filter(a=>a.round_number===room?.current_round)
  const submittedIds=new Set(roundAttempts.map(a=>a.player_id))
  const activeParticipantIds=new Set(participants.filter(p=>p.round_number===room?.current_round&&p.is_active).map(p=>p.player_id))
  const resultsRound=room?.last_completed_round||0
  const currentResults=room&&resultsRound>0?rankedRound(attempts,players,resultsRound):[]
  const history=room?roundHistory(attempts,players,resultsRound+1):[]
  const sessionStats=sessionRows(attempts,players)
  const matchStandings=finalMatchStandings(attempts,players)
  const standings=useMemo(()=>players.map(p=>({...p,round:attempts.find(a=>a.player_id===p.id&&a.round_number===room?.current_round)})).sort((a,b)=>(b.round?.score??-Infinity)-(a.round?.score??-Infinity)),[players,attempts,room])

  const refresh=useCallback(async(s:LocalSession)=>{
    if(!supabase)return
    const db=supabase;setLifecycle('loading')
    const{data:r}=await db.from('rooms').select('*').eq('id',s.roomId).maybeSingle()
    if(!r){removeSession(s.roomId);setError('Game could not be found.');setScreen('home');return}
    const [{data:p},{data:a},{data:rp},{data:mine}]=await Promise.all([
      db.from('players').select('*').eq('room_id',s.roomId).eq('is_active',true).order('joined_at'),
      db.from('attempts').select('*').eq('room_id',s.roomId),
      db.from('round_participants').select('*').eq('room_id',s.roomId),
      r.current_round>0?db.from('attempts').select('*').eq('room_id',s.roomId).eq('player_id',s.playerId).eq('round_number',r.current_round).maybeSingle():Promise.resolve({data:null}),
    ])
    const participant=(rp||[]).find(x=>x.round_number===r.current_round&&x.player_id===s.playerId&&x.is_active)||null
    let resolved=resolveMultiplayerState({room:r,playerId:s.playerId,participant,attempt:mine,activePlayerCount:(p||[]).length,submittedCount:(a||[]).filter(x=>x.round_number===r.current_round).length})
    setRoom(r);lastCompletedRef.current=r.last_completed_round||0;setPlayers(p||[]);setAttempts(a||[]);setParticipants(rp||[]);setLifecycle(resolved)
    if(import.meta.env.DEV)console.debug('[Circle state]',{roomId:r.id,roomCode:r.room_code,status:r.status,round:r.current_round,playerId:s.playerId,participant:Boolean(participant),attempt:Boolean(mine),resolved})
    if(resolved==='closed'){removeSession(s.roomId);setError('Game has ended.');setScreen('home')}
    else if(resolved==='draw'||resolved==='next_round_ready'){setScreen('lobby');setRoomView('game')}
    else if(resolved==='results'||resolved==='final_results'){setScreen('lobby');setRoomView('results')}
    else{setScreen('lobby');setRoomView('game')}
  },[])
  const loadActiveGames=useCallback(async()=>{
    if(!supabase)return
    const db=supabase
    const saved=Object.values(readSessions().sessions)
    const games=(await Promise.all(saved.map(async s=>{const [{data:r},{count},{data:a}]=await Promise.all([db.from('rooms').select('*').eq('id',s.roomId).neq('status','closed').maybeSingle(),db.from('players').select('*',{count:'exact',head:true}).eq('room_id',s.roomId).eq('is_active',true),db.from('attempts').select('round_number').eq('room_id',s.roomId).eq('player_id',s.playerId)]);return r?{session:s,room:r,playerCount:count||0,submitted:(a||[]).some(x=>x.round_number===r.current_round)}:null}))).filter(Boolean) as ActiveGame[]
    setActiveGames(games);const ids=new Set(games.map(g=>g.room.id));saved.forEach(s=>{if(!ids.has(s.roomId))removeSession(s.roomId)})
  },[])
  useEffect(()=>{loadActiveGames()},[loadActiveGames])
  useEffect(()=>{if(roomView==='game'&&session)refresh(session)},[roomView,session,refresh])
  useEffect(()=>{
    const sharedCode=sharedRoomCode(location.href);if(!sharedCode||!supabase)return
    setRoomInput(sharedCode);setMode('join')
    supabase.from('rooms').select('*').eq('room_code',sharedCode).maybeSingle().then(async({data:r})=>{
      if(!r){setError('That room could not be found.');setScreen('form');return}
      const store=readSessions(),known=identityForRoom(r.id,store.sessions,store.identities)
      if(known){saveSession(known);setSession(known);await refresh(known)}else{setRoom(r);const{data:p}=await supabase!.from('players').select('*').eq('room_id',r.id).eq('is_active',true);setPlayers(p||[]);setScreen('form')}
    })
  },[refresh])
  useEffect(()=>{const f=(event:Event)=>{const apply=(event as CustomEvent<()=>void>).detail;setApplyUpdate(()=>apply)};addEventListener('circle:update-ready',f);return()=>removeEventListener('circle:update-ready',f)},[])
  useEffect(()=>{
    if(!supabase||!session)return
    const db=supabase;seedComplete.current=false;alertTracker.current=new SubmissionAlertTracker()
    db.from('attempts').select('id').eq('room_id',session.roomId).then(({data})=>{alertTracker.current.seed((data||[]).map(a=>a.id));seedComplete.current=true})
    const announce=(text:string,strong=false)=>{setNotice(text);navigator.vibrate?.(strong?[70,45,70]:35);setTimeout(()=>setNotice(''),strong?3500:2600)}
    const ch=db.channel(`room:${session.roomId}`)
      .on('postgres_changes',{event:'*',schema:'public',table:'players',filter:`room_id=eq.${session.roomId}`},()=>refresh(session))
      .on('postgres_changes',{event:'*',schema:'public',table:'round_participants',filter:`room_id=eq.${session.roomId}`},()=>refresh(session))
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'attempts',filter:`room_id=eq.${session.roomId}`},payload=>{const a=payload.new as Attempt;if(!seedComplete.current||a.player_id===session.playerId||!alertTracker.current.accept(a.id))return;const who=playersRef.current.find(p=>p.id===a.player_id)?.display_name||'A player';announce(`${who} submitted Round ${a.round_number}`)})
      .on('postgres_changes',{event:'*',schema:'public',table:'attempts',filter:`room_id=eq.${session.roomId}`},()=>refresh(session))
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'rooms',filter:`id=eq.${session.roomId}`},payload=>{const after=payload.new as Room;if(after.last_completed_round>lastCompletedRef.current){lastCompletedRef.current=after.last_completed_round;announce(`Round ${after.last_completed_round} complete — results are ready`,true);if(after.status==='drawing')setTimeout(()=>announce(`Round ${after.current_round} is ready`,true),1200)}refresh(session)}).subscribe()
    return()=>{db.removeChannel(ch)}
  },[session,refresh])

  async function enter(){
    setError('');if(!name.trim())return setError('Add a display name first.');if(!isSupabaseReady)return setError('Multiplayer needs Supabase setup. Solo Practice is ready now.')
    setBusy(true)
    try{
      if(mode==='create'){
        let payload:any=null;for(let i=0;i<5&&!payload;i++){const{data,error:e}=await supabase!.rpc('create_circle_game',{p_room_code:makeCode(),p_display_name:name.trim(),p_expected:expectedPlayers});if(!e)payload=data}
        if(!payload)throw Error('create');const created=payload.room,p=payload.player
        const s={roomId:created.id,roomCode:created.room_code,playerId:p.id,name:name.trim(),isHost:true};saveSession(s);setSession(s);await refresh(s)
      }else{
        const{data:r,error:e}=await supabase!.from('rooms').select('*').eq('room_code',roomInput.trim().toUpperCase()).maybeSingle();if(e||!r)throw Error('invalid');if(r.status==='closed')throw Error('room_closed')
        const store=readSessions(),known=store.sessions[r.id]||store.identities[r.id]
        if(known){const{data:ok}=await supabase!.rpc('rejoin_circle_player',{p_room_id:r.id,p_player_id:known.playerId});if(ok){saveSession(known);setSession(known);setRoom(r);setScreen('lobby');await refresh(known);return}}
        const{data:old}=await supabase!.from('players').select('*').eq('room_id',r.id).ilike('display_name',name.trim()).maybeSingle()
        if(old){await supabase!.rpc('rejoin_circle_player',{p_room_id:r.id,p_player_id:old.id});const s={roomId:r.id,roomCode:r.room_code,playerId:old.id,name:old.display_name,isHost:old.is_host};saveSession(s);setSession(s);setRoom(r);setScreen('lobby');await refresh(s);return}
        const{data:p,error:pe}=await supabase!.rpc('join_circle_game',{p_room_id:r.id,p_display_name:name.trim()});if(pe)throw pe
        const s={roomId:r.id,roomCode:r.room_code,playerId:p.id,name:name.trim(),isHost:false};saveSession(s);setSession(s);setRoom(r);setScreen('lobby');await refresh(s)
      }
    }catch(e){setError(/room_closed/.test(String(e))?'Game has ended.':/invalid/.test(String(e))?'That room could not be found.':messageFor(e))}finally{setBusy(false)}
  }
  const home=()=>{setScreen('home');setSession(null);setRoom(null);setPlayers([]);setAttempts([]);setResult(null);setRoomView('game');setError('');loadActiveGames()}
  const openGame=async(g:ActiveGame)=>{setSession(g.session);setRoom(g.room);setScreen('lobby');await refresh(g.session)}
  const forget=(id:string)=>{removeSession(id);setActiveGames(g=>g.filter(x=>x.room.id!==id))}
  async function changePlayerCount(){if(!room||!session)return;const next=Number(prompt(`Continue with how many players? (${players.length}–${room.expected_player_count})`,String(players.length)));if(!Number.isInteger(next)||next<players.length||next>room.expected_player_count)return setError(`Choose ${players.length} to ${room.expected_player_count} players.`);if(!confirm(`Continue this game with ${next} players instead of ${room.expected_player_count}?`))return;const{error:e}=await supabase!.rpc('change_circle_player_count',{p_room_id:room.id,p_host_player_id:session.playerId,p_expected:next});if(e)setError(messageFor(e,'Could not change the player count.'));await refresh(session)}
  async function submit(points:Point[],score:ScoreResult){setResult({points,score});if(!score.valid)return;if(solo){setScreen('result');localStorage.setItem(BEST_KEY,String(Math.max(score.score,Number(localStorage.getItem(BEST_KEY)||0))));return}if(!room||!session||lifecycle!=='draw')return;setLifecycle('loading');const authoritativeRound=room.current_round;const{data:persisted,error:e}=await supabase!.from('attempts').insert({room_id:room.id,player_id:session.playerId,round_number:authoritativeRound,score:score.score,rating:ratingFor(score.score),points:simplify(points),radial_error:score.radialError,closure_error:score.closureRatio,smoothness_score:score.smoothness,angular_coverage:score.angularCoverage}).select().single();if(e){setError(/unique|duplicate/i.test(e.message)?'You already submitted this round.':'Your circle could not be submitted.');await refresh(session);return}if(persisted)setAttempts(old=>[...old.filter(a=>a.id!==persisted.id),persisted]);await supabase!.rpc('complete_circle_round',{p_room_id:room.id,p_round_number:authoritativeRound});await refresh(session)}
  async function removePlayer(playerId:string){if(!room||!session)return;await supabase!.rpc('remove_circle_player',{p_room_id:room.id,p_host_player_id:session.playerId,p_player_id:playerId});await refresh(session)}
  async function endGame(){if(!room||!session||!confirm('End this game and declare the current winner?'))return;await supabase!.rpc('end_circle_match',{p_room_id:room.id,p_host_player_id:session.playerId});await refresh(session)}
  async function keepPlaying(){if(!room||!session)return;await supabase!.rpc('extend_circle_match',{p_room_id:room.id,p_host_player_id:session.playerId});setRoomView('game');await refresh(session)}
  const share=async()=>{if(!session)return;const url=sharedRoomUrl(location.href,session.roomCode);const text=`Join my Circle game! Room: ${session.roomCode}`;if(navigator.share)await navigator.share({title:'Circle',text,url});else{await navigator.clipboard.writeText(url);setCopied(true);setTimeout(()=>setCopied(false),1500)}}
  const updateControl=applyUpdate&&screen!=='draw'?<button className="update-pill" onClick={applyUpdate}>Update available — Refresh</button>:null

  if(screen==='draw'&&!solo&&lifecycle!=='draw')return <main className="game"><p className="waiting">Loading game…</p></main>

  if(screen==='home')return <main className="home"><header><Mark/><span className="eyebrow">A very serious game</span><h1>CIRCLE<span>.</span></h1><p>Draw one. Find out how round you really are.</p></header>{activeGames.length>0&&<section className="active-games"><span className="eyebrow">Active games</span>{activeGames.map(g=><div className="active-game" key={g.room.id}><span><strong>{g.room.room_code}</strong><small>{activeGameStatus(g.room,g.playerCount,g.submitted)}</small></span><button onClick={()=>openGame(g)}>Open</button><button className="remove" aria-label={`Remove ${g.room.room_code}`} onClick={()=>forget(g.room.id)}>×</button></div>)}</section>}<div className="home-actions"><button className="primary" onClick={()=>{setMode('create');setScreen('form')}}>Create game <b>↗</b></button><button onClick={()=>{setMode('join');setScreen('form')}}>Join game <b>→</b></button><button className="ghost" onClick={()=>{setMode('solo');setScreen('draw')}}>Solo practice <b>◎</b></button></div><footer>No sign-up. No geometry degree. · v{__APP_VERSION__}</footer>{updateControl}</main>
  if(screen==='form')return <main className="panel"><button className="back" onClick={home}>← Back</button><Mark small/><span className="eyebrow">{mode==='create'?'Call the meeting':'Enter the arena'}</span><h2>{mode==='create'?'Create a game':'Join a game'}</h2>{mode==='join'&&room&&<p className="waiting">Room {room.room_code} · {players.length} / {room.expected_player_count} players</p>}<label>Your name<input autoFocus maxLength={24} value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Maya"/></label>{mode==='create'&&<label>Number of players<select value={expectedPlayers} onChange={e=>setExpectedPlayers(Number(e.target.value))}>{Array.from({length:9},(_,i)=>i+2).map(n=><option key={n} value={n}>{n}</option>)}</select></label>}{mode==='join'&&<label>Room code<input className="code-input" maxLength={5} value={roomInput} onChange={e=>setRoomInput(e.target.value.toUpperCase())} placeholder="ABCDE"/></label>}<p className="error" role="alert">{error}</p><button className="primary" disabled={busy} onClick={enter}>{busy?'One moment…':mode==='create'?'Create room':'Join room'} <b>→</b></button>{updateControl}</main>
  if(screen==='lobby'&&room&&session&&isFinalMatch(room))return <main className="panel final-match"><RoomTabs view="results" setView={v=>{if(v!=='results')setRoomView(v)}} hasResults onHome={home}/><span className="eyebrow">Game winner</span><h2>{matchStandings[0]?.tied?'It’s a tie':matchStandings[0]?.player.display_name||'Final results'}</h2><FinalMatch rows={matchStandings}/><History history={roundHistory(attempts,players,room.current_round+1)}/>{session.isHost&&<button className="primary dock" onClick={keepPlaying}>Keep Playing <b>→</b></button>}{!session.isHost&&<p className="waiting">Game complete</p>}{updateControl}</main>
  if(screen==='lobby'&&room&&session&&roomView==='results')return <main className="panel room-results"><RoomTabs view={roomView} setView={setRoomView} hasResults={currentResults.length>0}/><span className="eyebrow">Round {resultsRound} results</span><h2>Round standings</h2><RoundResults rows={currentResults} myId={session.playerId}/>{room.status==='drawing'&&<button className="primary dock" onClick={()=>{setRoomView('game');refresh(session)}}>Draw Round {room.current_round} <b>→</b></button>}{session.isHost&&<button className="end-game" onClick={endGame}>End Game</button>}{updateControl}</main>
  if(screen==='lobby'&&room&&session&&roomView==='history')return <main className="panel"><RoomTabs view={roomView} setView={setRoomView} hasResults={currentResults.length>0}/><span className="eyebrow">Room {room.room_code}</span><h2>Round history</h2><History history={history}/>{updateControl}</main>
  if(screen==='lobby'&&room&&session&&roomView==='session')return <main className="panel"><RoomTabs view={roomView} setView={setRoomView} hasResults={currentResults.length>0}/><span className="eyebrow">This room</span><h2>Session leaderboard</h2><SessionLeaderboard rows={sessionStats}/>{updateControl}</main>
  if(screen==='lobby'&&room&&session)return <main className="panel lobby"><RoomTabs view={roomView} setView={setRoomView} hasResults={currentResults.length>0}/><div className="top"><button className="back" onClick={home}>← Home</button><button className="text-btn" onClick={()=>setRoomView(room.status==='results'?'results':'session')}>{room.status==='results'?'View results':'Leaderboard'}</button></div><span className="eyebrow">Room code</span><h2 className="room-code">{room.room_code}</h2><button className="share" onClick={share}>{copied?'Copied!':'Share game'} <b>↗</b></button>{session.isHost&&<div className="reveal"><span>Reveal scores</span><button aria-pressed={room.reveal_mode==='all_submitted'} onClick={async()=>{const v=room.reveal_mode==='all_submitted'?'immediate':'all_submitted';setRoom({...room,reveal_mode:v});await supabase!.from('rooms').update({reveal_mode:v}).eq('id',room.id)}}><i/>{room.reveal_mode==='all_submitted'?'When everyone finishes':'As players finish'}</button></div>}<section><div className="section-title"><h3>Players</h3><span>{players.length} / {room.expected_player_count} joined · {submittedIds.size} submitted</span></div><ul className="players">{players.map(p=>{const submitted=submittedIds.has(p.id),included=activeParticipantIds.has(p.id);return <li key={p.id}><span className="avatar">{p.display_name[0].toUpperCase()}</span><strong>{p.display_name}{p.id===session.playerId?' (you)':''}</strong>{p.is_host&&<em>Host</em>}<span className={submitted?'submitted':'drawing'}>{room.status==='lobby'?'Ready':!included?'Next round':submitted?'Submitted ✓':'Drawing…'}</span>{session.isHost&&!p.is_host&&<button className="kick" aria-label={`Remove ${p.display_name}`} onClick={()=>removePlayer(p.id)}>Remove</button>}</li>})}</ul></section>{room.status==='drawing'&&<><p className="waiting">{submittedIds.has(session.playerId)?<>Submitted ✓<br/>{players.length<room.expected_player_count?'Waiting for players':`Waiting for ${players.length-submittedIds.size} attempt(s)`}<br/>{players.length} / {room.expected_player_count} joined</>:lifecycle==='next_round_ready'?`Round ${room.current_round} ready — your turn`:'Your turn'}</p>{!submittedIds.has(session.playerId)&&<button className="primary dock" onClick={()=>setScreen('draw')}>Draw Round {room.current_round} <b>→</b></button>}{session.isHost&&room.expected_player_count>players.length&&<button className="text-btn" onClick={changePlayerCount}>Change player count</button>}</>}{error&&<p className="error" role="alert">{error}</p>}{notice&&<div className="game-notice" role="status">{notice}</div>}{updateControl}</main>
  if(screen==='draw')return <main className="game"><div className="game-head"><button className="back" onClick={home}>← Home</button><span>{solo?'Solo practice':`Round ${room?.current_round}`}</span><span className="dot">● LIVE</span></div><h2>Draw one circle.</h2><p>One stroke. No do-overs.</p><DrawPad onDone={submit}/>{result&&!result.score.valid&&<div className="toast" role="alert">{result.score.reason}<button onClick={()=>setResult(null)}>Try again</button></div>}<div className="tip"><b>TIP</b> Slow and steady beats fast and wobbly.</div>{notice&&<div className="game-notice dark" role="status">{notice}</div>}</main>
  if(screen==='result'&&!result&&room&&session)return <main className="panel room-results"><RoomTabs view="results" setView={v=>{setRoomView(v);setScreen('lobby')}} hasResults={currentResults.length>0}/><span className="eyebrow">Round {room.current_round} results</span><h2>Final standings</h2><RoundResults rows={currentResults} myId={session.playerId}/>{updateControl}</main>
  if(screen==='result'&&result){const s=result.score;return <main className="result"><div className="game-head"><button className="back" onClick={home}>×</button><span>{solo?'Solo result':`Round ${room?.current_round}`}</span><span/></div><span className="eyebrow">Your circle</span><DrawPad preview={result}/><div className="score"><span>ROUNDNESS</span><strong>{s.score.toFixed(1)}</strong><small>/ 100</small><h2>{ratingFor(s.score)}</h2></div>{import.meta.env.DEV&&<details><summary>Scoring diagnostics · v{__APP_VERSION__}</summary><pre>{JSON.stringify({center:s.center,radius:s.radius,radialStdDev:s.radialStdDev,radialError:s.radialError,closureRatio:s.closureRatio,closureScore:s.closureScore,smoothness:s.smoothness,angularCoverage:s.angularCoverage,coverageScore:s.coverageScore,retracePenalty:s.retracePenalty,final:s.score},null,2)}</pre></details>}{solo?<div className="result-actions"><button className="primary" onClick={()=>{setResult(null);setScreen('draw')}}>Try again <b>↻</b></button><p>Personal best: <strong>{Math.max(s.score,Number(localStorage.getItem(BEST_KEY)||0)).toFixed(1)}</strong></p></div>:<><Leaderboard standings={standings} hidden={room?.status!=='results'&&room?.reveal_mode==='all_submitted'}/></>}{notice&&<div className="game-notice" role="status">{notice}</div>}{updateControl}</main>}
  return null
}

function Leaderboard({standings,hidden}:{standings:any[];hidden:boolean}){return <section className="leader"><div className="section-title"><h3>Leaderboard</h3><span>{hidden?'Scores hidden':'Round results'}</span></div>{hidden?<p className="waiting">Waiting for everyone to finish…</p>:<ol>{standings.filter(p=>p.round).map((p,i)=><li className={i===0?'winner':''} key={p.id}><b>{i+1}</b><span><strong>{p.display_name}</strong><small>{ratingFor(p.round.score)}</small></span><em>{p.round.score.toFixed(1)}</em></li>)}</ol>}</section>}

function RoomTabs({view,setView,hasResults,onHome}:{view:RoomView;setView:(v:RoomView)=>void;hasResults:boolean;onHome?:()=>void}){const goHome=onHome||(()=>{const url=new URL(location.href);url.search='';location.assign(url.toString())});return <><button className="room-home" onClick={goHome}>← Home</button><nav className="room-tabs" aria-label="Room views"><button className={view==='game'?'active':''} onClick={()=>setView('game')}>Game</button><button className={view==='results'?'active':''} disabled={!hasResults} onClick={()=>setView('results')}>Results</button><button className={view==='history'?'active':''} onClick={()=>setView('history')}>History</button><button className={view==='session'?'active':''} onClick={()=>setView('session')}>Session</button></nav></>}
function RoundResults({rows,myId}:{rows:ReturnType<typeof rankedRound>;myId:string}){return <ol className="round-results">{rows.map(row=><li key={row.id} className={`${row.winner?'winner ':''}${row.player_id===myId?'mine':''}`}><b>{row.rank}</b><span><strong>{row.playerName}{row.player_id===myId?' (you)':''}</strong><small>{row.rating}</small></span><em>{row.score.toFixed(1)}</em>{row.winner&&<i>Winner</i>}</li>)}</ol>}
function History({history}:{history:ReturnType<typeof roundHistory>}){return <div className="history">{history.length?history.map(round=><section key={round.roundNumber}><h3>Round {round.roundNumber}</h3>{round.results.map(row=><div key={row.id}><b>{row.rank}</b><span>{row.playerName}</span><strong>{row.score.toFixed(1)}</strong></div>)}</section>):<p className="waiting">Previous rounds will appear here.</p>}</div>}
function SessionLeaderboard({rows}:{rows:ReturnType<typeof sessionRows>}){return <ul className="stats">{rows.map((row,i)=><li key={row.player.id}><b>{i+1}</b><span><strong>{row.player.display_name}</strong><small>{row.played?`${row.played} played · ${row.wins} wins`:'No attempts yet'}</small></span><em>{row.average!==null&&row.best!==null?<>{row.average.toFixed(1)} avg<br/>{row.best.toFixed(1)} best</>:'—'}</em></li>)}</ul>}
function FinalMatch({rows}:{rows:ReturnType<typeof finalMatchStandings>}){return <ol className="final-standings">{rows.map(row=><li key={row.player.id}><b>{row.rank}</b><span><strong>{row.player.display_name}</strong><small>{row.roundWins} {row.roundWins===1?'win':'wins'} · {row.played} rounds</small></span><em>{row.average.toFixed(1)} avg<br/>{row.best.toFixed(1)} best</em></li>)}</ol>}
