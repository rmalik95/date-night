"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Check, Crown, Eraser, Heart, Music2, PenLine, RotateCcw, Sparkles, Trophy, Wifi, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast, Toaster } from "sonner";
import content from "@/content/public-date-night.json";
import type { AchievementId, Point, Role, RoomAction, RoomResponse, RoomState, Stage, Stroke } from "./room-types";

const stages: Stage[] = ["lobby", "quiz", "draw", "memories", "finale", "ending"];
const labels = ["Meet", "Know us", "Draw", "Remember", "Reveal", "Cheers"];
const bits = ["✦", "♥", "✧", "•", "♥", "✦", "•", "✧"];
const emptyState: RoomState = { revision: 0, stage: "lobby", hostPresent: false, guestPresent: false, firstArrival: null, quizIndex: 0, answers: {}, matchedQuizAnswers: 0, drawRound: 0, drawer: "host", strokes: [], guesses: [], completedDrawRounds: 0, memoryIndex: 0, memoryNotes: {}, ready: { host: false, guest: false }, finaleUnlocked: false, lovePoints: { host: 0, guest: 0 }, achievements: [], surprises: { quiz: false, draw: false, memory: false }, keepsakes: [] };

function credentials() {
  if (typeof window === "undefined") return { role: "guest" as Role, token: "" };
  const params = new URLSearchParams(window.location.search || sessionStorage.getItem("date-night-invite") || "");
  if (window.location.search) sessionStorage.setItem("date-night-invite", window.location.search);
  const role: Role = params.has("host") ? "host" : "guest";
  return { role, token: params.get(role) ?? "" };
}
function Celebration({ stage }: { stage: Stage }) {
  if (stage === "lobby") return null;
  return <div className="stage-celebration" aria-hidden="true">{bits.map((bit, i) => <span key={`${stage}-${i}`} style={{ "--i": i } as React.CSSProperties}>{stage === "ending" && i % 2 ? "♥" : bit}</span>)}</div>;
}
function total(state: RoomState) { return state.lovePoints.host + state.lovePoints.guest; }
function SurpriseBoxes({ state }: { state: RoomState }) {
  return <aside className="surprise-boxes" aria-label="Evening surprises">{(["quiz", "draw", "memory"] as const).map((id) => <div className={state.surprises[id] ? "surprise open" : "surprise"} key={id}><span>{state.surprises[id] ? "✦" : "?"}</span><div><small>{content.surprises[id].title}</small><p>{state.surprises[id] ? content.surprises[id].message : "Keep making memories to unlock this."}</p></div></div>)}</aside>;
}
function Achievements({ state }: { state: RoomState }) {
  const [open, setOpen] = useState(false);
  return <aside className="achievement-drawer"><Button variant="outline" className="achievement-toggle" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-controls="achievements"><Trophy /> {state.achievements.length}/4</Button>{open && <div id="achievements" className="achievement-list">{(Object.keys(content.achievements) as AchievementId[]).map((id) => <div className={state.achievements.includes(id) ? "achievement unlocked" : "achievement"} key={id}><span>{state.achievements.includes(id) ? "✓" : "○"}</span><div><strong>{content.achievements[id].title}</strong><small>{content.achievements[id].description}</small></div></div>)}</div>}</aside>;
}

export default function Home() {
  const [{ role, token }, setCredentials] = useState<{ role: Role; token: string }>({ role: "guest", token: "" });
  const [state, setState] = useState<RoomState>(emptyState);
  const [secret, setSecret] = useState<RoomResponse["secret"]>();
  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState(true);
  const [announcement, setAnnouncement] = useState("Welcome to your date night.");
  const stageRef = useRef<HTMLElement>(null);
  const latest = useRef(emptyState);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const accept = useCallback((data: RoomResponse) => { if (data.state.revision < latest.current.revision) return; latest.current = data.state; setState(data.state); setSecret(data.secret); }, []);
  useEffect(() => { const resolveCredentials = setTimeout(() => setCredentials(credentials()), 0); return () => clearTimeout(resolveCredentials); }, []);
  const refresh = useCallback(async () => {
    if (!token) { setLoading(false); return; }
    try {
      const res = await fetch(`/api/room?role=${role}&token=${encodeURIComponent(token)}`, { cache: "no-store", signal: AbortSignal.timeout(10000) });
      if (!res.ok) throw new Error();
      const data = await res.json() as RoomResponse;
      accept(data); setOnline(true);
    } catch { setOnline(false); } finally { setLoading(false); }
  }, [role, token, accept]);
  const act = useCallback((action: RoomAction): Promise<boolean> => {
    const context = latest.current;
    const run = async () => {
      for (let attempt = 0; attempt < 4; attempt++) {
        const now = latest.current;
        if (action.type !== "arrive" && (now.stage !== context.stage || now.quizIndex !== context.quizIndex || now.drawRound !== context.drawRound || now.memoryIndex !== context.memoryIndex)) {
          toast.info("The activity moved on. Your screen is up to date."); return false;
        }
        try {
          const res = await fetch("/api/room", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ role, token, expectedRevision: now.revision, action }), signal: AbortSignal.timeout(10000) });
          const data = await res.json() as RoomResponse & { error?: string };
          if (data.state) accept(data);
          setOnline(true);
          if (res.status === 409) continue;
          if (!res.ok) { toast.error(data.error ?? "Couldn’t save that."); return false; }
          if (data.notice) { setAnnouncement(data.notice); toast.success(data.notice); }
          return true;
        } catch { setOnline(false); toast.error("Connection interrupted. Please try again."); return false; }
      }
      toast.error("The room is busy. Please try again."); return false;
    };
    const result = queue.current.then(run);
    queue.current = result.catch(() => false);
    return result;
  }, [role, token, accept]);
  useEffect(() => { const initial = setTimeout(refresh, 0); const poll = setInterval(refresh, state.stage === "draw" ? 900 : 2400); return () => { clearTimeout(initial); clearInterval(poll); }; }, [refresh, state.stage]);
  useEffect(() => { stageRef.current?.focus(); const announce = setTimeout(() => setAnnouncement(`Now in ${labels[stages.indexOf(state.stage)]}.`), 0); return () => clearTimeout(announce); }, [state.stage]);
  const index = stages.indexOf(state.stage);
  if (!loading && !token) return <main className="loading"><Heart /><p>Open your host or guest invitation to join.</p><a href="/scrapbook">Visit our scrapbook</a></main>;
  if (loading) return <main className="loading"><Sparkles /><p>Lighting the candles…</p></main>;
  if (!online && state.revision === 0) return <main className="loading"><WifiOff /><p>We couldn’t open your room. Check your invitation and connection.</p><Button onClick={() => void refresh()}>Try again</Button></main>;
  return <main className="app-shell romantic">
    <div className="ambient" /><Celebration key={state.stage} stage={state.stage} />
    <p className="sr-only" aria-live="polite">{announcement}</p>
    <header className="topbar"><div className="brand"><span className="brand-mark"><span className="brand-letters">G<b>&</b>R</span></span><div><strong>Anniversary Arcade</strong><small>{content.couple.anniversary}</small></div></div><div className="topbar-tools"><div className="love-score" aria-label={`${total(state)} shared love points`}><Heart /><strong>{total(state)}</strong><small>love points</small></div><Achievements state={state} /><div className={`connection ${online ? "online" : "offline"}`}>{online ? <Wifi /> : <WifiOff />}{online ? "Together" : "Reconnecting"}</div></div></header>
    <nav className="journey" aria-label="Date night progress">{labels.map((label, i) => <div key={label} className={i <= index ? "active" : ""}><span>{i < index ? <Check /> : i + 1}</span><small>{label}</small></div>)}</nav>
    <Progress className="journey-progress" value={(index / (stages.length - 1)) * 100} />
    <section className="stage-card" ref={stageRef} tabIndex={-1}>
      {state.stage === "lobby" && <Lobby role={role} state={state} act={act} />}
      {state.stage === "quiz" && <Quiz role={role} state={state} act={act} />}
      {state.stage === "draw" && <Drawing key={state.drawRound} role={role} state={state} act={act} />}
      {state.stage === "memories" && <Memories key={state.memoryIndex} role={role} state={state} act={act} />}
      {state.stage === "finale" && <Finale role={role} state={state} secret={secret} act={act} />}
      {state.stage === "ending" && <Ending role={role} state={state} act={act} />}
    </section>
    <SurpriseBoxes state={state} />
    <footer><span>{role === "host" ? content.couple.host : content.couple.guest}, you’re here as {role === "host" ? "the evening’s host" : "the guest of honour"}.</span><span>Made for just two.</span></footer><Toaster theme="dark" position="top-center" />
  </main>;
}
function Eyebrow({ children }: { children: React.ReactNode }) { return <p className="eyebrow"><Sparkles />{children}</p>; }
function HostAdvance({ role, onClick, children, disabled = false }: { role: Role; onClick: () => void; children: React.ReactNode; disabled?: boolean }) { return role === "host" ? <Button className="gold-button" onClick={onClick} disabled={disabled}>{children}<ArrowRight /></Button> : <p className="waiting"><span />Rishabh will take you to the next chapter</p>; }
function Lobby({ role, state, act }: { role: Role; state: RoomState; act: (action: RoomAction) => Promise<boolean> }) {
  useEffect(() => { if (!state[role === "host" ? "hostPresent" : "guestPresent"]) { const arrival = setTimeout(() => { void act({ type: "arrive" }); }, 0); return () => clearTimeout(arrival); } }, [act, role, state]);
  const both = state.hostPresent && state.guestPresent;
  return <div className="split hero-stage"><div className="hero-copy"><Eyebrow>Three years, one more adventure</Eyebrow><h1>Tonight is ours.</h1><p className="lede">A little competition, a lot of remembering, and small surprises waiting along the way.</p><div className="presence"><Person name={content.couple.host} here={state.hostPresent} /><div className="gold-thread" /><Person name={content.couple.guest} here={state.guestPresent} /></div><div className="actions"><HostAdvance role={role} disabled={!both} onClick={() => void act({ type: "advanceLobby" })}>{both ? "Begin our night" : "Waiting for your favourite person"}</HostAdvance><a className="music-link" href="https://open.spotify.com/search/Taylor%20Swift%20Love%20Story" target="_blank" rel="noreferrer" aria-label="Open Love Story by Taylor Swift in Spotify"><Music2 />Play Love Story</a><a className="music-link scrapbook-link" href="/scrapbook"><Heart />Our scrapbook</a></div></div><div className="hero-art"><Image src="/anniversary-night.png" alt="Two warmly lit windows connected beneath a moonlit sky" fill priority sizes="(max-width: 760px) 100vw, 50vw" /><span className="tape">Open when we’re both here</span></div></div>;
}
function Person({ name, here }: { name: string; here: boolean }) { return <div className={here ? "person here" : "person"}><span>{name[0]}</span><div><strong>{name}</strong><small>{here ? "is here" : "not here yet"}</small></div></div>; }
function Quiz({ role, state, act }: { role: Role; state: RoomState; act: (action: RoomAction) => Promise<boolean> }) {
  const q = content.quiz[state.quizIndex], mine = state.answers[String(state.quizIndex)]?.[role], other = state.answers[String(state.quizIndex)]?.[role === "host" ? "guest" : "host"], revealed = Boolean(mine && other);
  return <div className="content-stage"><Eyebrow>Round one · {state.quizIndex + 1} of {content.quiz.length}</Eyebrow><h2>{q.question}</h2><p className="subcopy">Choose privately. Your answers appear when you’ve both committed.</p><div className="choice-grid">{q.options.map((option) => <button key={option} disabled={Boolean(mine)} onClick={() => void act({ type: "answerQuiz", answer: option })} className={mine === option ? "selected" : ""} aria-pressed={mine === option}><span>{option}</span>{mine === option && <Check />}</button>)}</div>{mine && !other && <p className="waiting large"><span />Answer locked. Waiting for your favourite person…</p>}{revealed && <div className={mine === other ? "reveal match" : "reveal"}><small>You chose</small><strong>{mine}</strong><small>They chose</small><strong>{other}</strong><p>{mine === other ? "Perfectly in sync. Both of you earn love points." : "Different answers—this one deserves a story."}</p><HostAdvance role={role} onClick={() => void act({ type: "advanceQuiz" })}>{state.quizIndex < content.quiz.length - 1 ? "Next question" : "Open the sketchbook"}</HostAdvance></div>}</div>;
}
function Drawing({ role, state, act }: { role: Role; state: RoomState; act: (action: RoomAction) => Promise<boolean> }) {
  const canvas = useRef<HTMLCanvasElement>(null), drawing = useRef(false), current = useRef<Point[]>([]), pending = useRef<Stroke[]>([]), [guess, setGuess] = useState("");
  const prompt = content.drawPrompts[state.drawRound], isDrawer = role === state.drawer;
  const redraw = useCallback(() => { const c = canvas.current; if (!c) return; const ctx = c.getContext("2d"); if (!ctx) return; ctx.clearRect(0, 0, c.width, c.height); ctx.lineWidth = 5; ctx.lineCap = "round"; ctx.lineJoin = "round"; pending.current = pending.current.filter((pendingStroke) => !state.strokes.some((savedStroke) => savedStroke.points.length === pendingStroke.points.length && savedStroke.points[0]?.x === pendingStroke.points[0]?.x && savedStroke.points[0]?.y === pendingStroke.points[0]?.y && savedStroke.points.at(-1)?.x === pendingStroke.points.at(-1)?.x && savedStroke.points.at(-1)?.y === pendingStroke.points.at(-1)?.y)); const activeStroke = drawing.current && current.current.length > 1 ? [{ points: current.current, color: "#f0b75e" }] : []; [...state.strokes, ...pending.current, ...activeStroke].forEach((stroke) => { ctx.strokeStyle = stroke.color; ctx.beginPath(); stroke.points.forEach((point, i) => i ? ctx.lineTo(point.x * c.width, point.y * c.height) : ctx.moveTo(point.x * c.width, point.y * c.height)); ctx.stroke(); }); }, [state.strokes]);
  useEffect(redraw, [redraw]);
  const point = (event: React.PointerEvent) => { const rect = event.currentTarget.getBoundingClientRect(); return { x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)), y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)) }; };
  const up = () => { if (!drawing.current) return; drawing.current = false; if (current.current.length > 1) { const points = current.current.filter((_, index, all) => index % Math.max(1, Math.ceil(all.length / 999)) === 0); const stroke = { points, color: "#f0b75e" }; pending.current.push(stroke); void act({ type: "addStroke", stroke }).then((saved) => { if (!saved) { pending.current = pending.current.filter((item) => item !== stroke); } }); } };
  return <div className="draw-stage"><div className="draw-head"><div><Eyebrow>Sketchbook · Round {state.drawRound + 1} of 4</Eyebrow><h2>{isDrawer ? prompt : "What are they drawing?"}</h2><p>{isDrawer ? "Draw the prompt—no letters or numbers." : "Say it as soon as you know it."}</p></div><div className="score"><Crown /><strong>{total(state)}</strong><small>love points</small></div></div><div className="canvas-wrap"><canvas ref={canvas} width={1000} height={620} onPointerDown={(event) => { if (!isDrawer) return; drawing.current = true; current.current = [point(event)]; event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={(event) => { if (!drawing.current) return; const next = point(event); const previous = current.current[current.current.length - 1]; current.current.push(next); const canvasElement = canvas.current; const context = canvasElement?.getContext("2d"); if (canvasElement && context) { context.strokeStyle = "#f0b75e"; context.lineWidth = 5; context.lineCap = "round"; context.beginPath(); context.moveTo(previous.x * canvasElement.width, previous.y * canvasElement.height); context.lineTo(next.x * canvasElement.width, next.y * canvasElement.height); context.stroke(); } }} onPointerUp={up} onPointerCancel={up} aria-label={isDrawer ? "Shared drawing canvas. Draw with your pointer." : "Shared drawing canvas showing your partner's drawing."} /> <span className="canvas-label"><PenLine />{isDrawer ? "Your canvas" : "Live from their imagination"}</span>{isDrawer && <button className="clear" onClick={() => { pending.current = []; current.current = []; drawing.current = false; void act({ type: "clearDrawing" }); }} aria-label="Clear the drawing"><Eraser />Clear</button>}</div>{!isDrawer && <div className="guess-row"><input value={guess} onChange={(event) => setGuess(event.target.value)} onKeyDown={(event) => event.key === "Enter" && void act({ type: "submitGuess", guess }).then(() => setGuess(""))} placeholder="Type your guess…" aria-label="Your drawing guess" /><Button onClick={() => void act({ type: "submitGuess", guess }).then(() => setGuess(""))}>Send guess</Button></div>}{state.guesses.length > 0 && <div className="guess-cloud" aria-label="Recent guesses">{state.guesses.slice(-4).map((value, i) => <span key={`${value}-${i}`}>{value}</span>)}</div>}<HostAdvance role={role} onClick={() => void act({ type: "advanceDrawing" })}>{state.drawRound < 3 ? "Next drawing" : "Open the memory vault"}</HostAdvance></div>;
}
function Memories({ role, state, act }: { role: Role; state: RoomState; act: (action: RoomAction) => Promise<boolean> }) {
  const memory = content.memories[state.memoryIndex], notes = state.memoryNotes[String(state.memoryIndex)] ?? {}, mine = notes[role], other = notes[role === "host" ? "guest" : "host"], [note, setNote] = useState("");
  return <div className="memory-stage"><div className="polaroid"><div className={`memory-placeholder memory-${state.memoryIndex}`}><span>{String(state.memoryIndex + 1).padStart(2, "0")}</span><Heart /></div><p>{memory.caption}</p></div><div className="memory-copy"><Eyebrow>Memory {state.memoryIndex + 1} of {content.memories.length}</Eyebrow><h2>{memory.title}</h2><p>{memory.story}</p><blockquote>“{memory.prompt}”</blockquote><div className="memory-note"><label htmlFor="memory-note">A small detail you want to keep</label>{mine ? <p className="saved-note">{other ? <><strong>You both remembered:</strong> {mine} <span>·</span> {other}</> : "Your note is safe—waiting for theirs to reveal it."}</p> : <><textarea id="memory-note" value={note} onChange={(event) => setNote(event.target.value)} maxLength={280} placeholder="Write a short memory…" /><Button onClick={() => void act({ type: "saveMemoryNote", note }).then((saved) => saved && setNote(""))}>Save our memory</Button></>}</div><div className="memory-dots">{content.memories.map((_, i) => <span key={i} className={i === state.memoryIndex ? "active" : ""} />)}</div><HostAdvance role={role} disabled={!mine || !other} onClick={() => void act({ type: "advanceMemory" })}>{state.memoryIndex < content.memories.length - 1 ? "Next memory" : "One last thing…"}</HostAdvance></div></div>;
}
function Finale({ role, state, secret, act }: { role: Role; state: RoomState; secret: RoomResponse["secret"]; act: (action: RoomAction) => Promise<boolean> }) {
  if (!state.finaleUnlocked) return <div className="finale-ready"><Eyebrow>The final envelope</Eyebrow><div className="envelope"><Heart /><span>For Glyra</span></div><h2>Open this together?</h2><p>There’s a letter inside, and a plan I’ve been keeping just for tonight.</p><Button className="gold-button" disabled={state.ready[role]} onClick={() => void act({ type: "setFinaleReady" })}>{state.ready[role] ? "Waiting for the other half" : "I’m ready"}<Heart /></Button></div>;
  return <div className="letter-stage"><Eyebrow>For my favourite person</Eyebrow><article className="letter"><p>{secret?.letter ?? "The letter is waiting safely on the server."}</p><span>Always yours,<br /><strong>Rishabh</strong></span></article><div className="date-reveal"><small>Our next chapter</small><h2>{secret?.date.title}</h2><p>{secret?.date.description}</p><div className="date-details"><span><small>When</small>{secret?.date.when}</span><span><small>Where</small>{secret?.date.where}</span><span><small>Bring</small>{secret?.date.bring}</span></div></div><HostAdvance role={role} onClick={() => void act({ type: "advanceFinale" })}>Seal the evening</HostAdvance></div>;
}
function Ending({ role, state, act }: { role: Role; state: RoomState; act: (action: RoomAction) => Promise<boolean> }) {
  const [choosing, setChoosing] = useState(false);
  return <div className="ending"><div className="burst">✦</div><Eyebrow>Chapter three, complete</Eyebrow><h1>Same time next year?</h1><p className="lede">Together, you collected <strong>{total(state)} love points</strong>, unlocked {state.achievements.length} little milestones, and made new memories to keep.</p><div className="contribution-card"><span>{content.couple.host}: {state.lovePoints.host}</span><Heart /><span>{content.couple.guest}: {state.lovePoints.guest}</span></div>{state.keepsakes.length > 0 && <p className="keepsake-status">One of your evenings is safely kept.</p>}{role === "host" && !choosing && <Button variant="outline" onClick={() => setChoosing(true)}><RotateCcw />Replay our night</Button>}{role === "host" && choosing && <div className="replay-choice" role="dialog" aria-label="Choose replay mode"><strong>How should this evening live on?</strong><p>Start fresh, or save this shared score and your memory notes first.</p><Button className="gold-button" onClick={() => void act({ type: "restart", mode: "save" })}>Save our keepsake & replay</Button><Button variant="outline" onClick={() => void act({ type: "restart", mode: "fresh" })}>Start completely fresh</Button></div>}</div>;
}
