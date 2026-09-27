import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { rooms } from "@/db/schema";
import content from "@/content/date-night.json";
import type { AchievementId, Role, RoomAction, RoomResponse, RoomState, Stage, Stroke } from "@/app/room-types";

const TOKENS = { host: "rishabh-host-3years", guest: "glyra-guest-3years" } as const;
const ROOM_ID = "anniversary";
const stages: readonly Stage[] = ["lobby", "quiz", "draw", "memories", "finale", "ending"];

function freshState(hostPresent = false, guestPresent = false, keepsakes: RoomState["keepsakes"] = []): RoomState {
  return { revision: 0, stage: "lobby", hostPresent, guestPresent, firstArrival: null, quizIndex: 0, answers: {}, matchedQuizAnswers: 0, drawRound: 0, drawer: "host", strokes: [], guesses: [], completedDrawRounds: 0, memoryIndex: 0, memoryNotes: {}, ready: { host: false, guest: false }, finaleUnlocked: false, lovePoints: { host: 0, guest: 0 }, achievements: [], surprises: { quiz: false, draw: false, memory: false }, keepsakes };
}
function auth(role: string | null, token: string | null): role is Role { return (role === "host" || role === "guest") && token === TOKENS[role]; }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function error(message: string, status: number, state?: RoomState) { return Response.json(state ? { error: message, state } : { error: message }, { status }); }
function response(state: RoomState, role: Role, notice?: string): RoomResponse { const visible = structuredClone(state); for (const collection of [visible.answers, visible.memoryNotes]) { for (const pair of Object.values(collection)) { if (!pair.host || !pair.guest) delete pair[role === "host" ? "guest" : "host"]; } } return { state: visible, ...(state.finaleUnlocked ? { secret: { letter: content.letter, dates: content.futureDates } } : {}), ...(notice ? { notice } : {}) }; }
function validStroke(stroke: unknown): stroke is Stroke { return isRecord(stroke) && typeof stroke.color === "string" && /^#[0-9a-f]{6}$/i.test(stroke.color) && Array.isArray(stroke.points) && stroke.points.length > 0 && stroke.points.length <= 1000 && stroke.points.every((point) => isRecord(point) && typeof point.x === "number" && Number.isFinite(point.x) && point.x >= 0 && point.x <= 1 && typeof point.y === "number" && Number.isFinite(point.y) && point.y >= 0 && point.y <= 1); }

/** Gives old persisted rooms safe defaults as the shared game gains new features. */
function normalize(value: unknown): RoomState {
  if (!isRecord(value)) return freshState();
  const base = freshState();
  return { ...base, ...value, revision: typeof value.revision === "number" ? value.revision : 0, stage: stages.includes(value.stage as Stage) ? value.stage as Stage : base.stage, lovePoints: isRecord(value.lovePoints) && typeof value.lovePoints.host === "number" && typeof value.lovePoints.guest === "number" ? { host: value.lovePoints.host, guest: value.lovePoints.guest } : base.lovePoints, achievements: Array.isArray(value.achievements) ? value.achievements.filter((id): id is AchievementId => id === "earlyBird" || id === "quizMaster" || id === "artisticSoul" || id === "memoryPalace") : base.achievements, surprises: isRecord(value.surprises) ? { quiz: value.surprises.quiz === true, draw: value.surprises.draw === true, memory: value.surprises.memory === true } : base.surprises, memoryNotes: isRecord(value.memoryNotes) ? value.memoryNotes as RoomState["memoryNotes"] : {}, keepsakes: Array.isArray(value.keepsakes) ? value.keepsakes as RoomState["keepsakes"] : [] };
}
async function load(): Promise<RoomState> { const db = getDb(); const row = await db.select().from(rooms).where(eq(rooms.id, ROOM_ID)).get(); if (row) return normalize(JSON.parse(row.state)); const state = freshState(); await db.insert(rooms).values({ id: ROOM_ID, state: JSON.stringify(state), updatedAt: new Date() }).onConflictDoNothing(); return load(); }

function unlock(state: RoomState, id: AchievementId, notices: string[]) { if (!state.achievements.includes(id)) { state.achievements.push(id); const copy = content.achievements[id]; notices.push(`Achievement unlocked: ${copy.title}`); } }
function addPoints(state: RoomState, role: Role, amount: number) { state.lovePoints[role] += amount; }
function addBoth(state: RoomState, amount: number) { addPoints(state, "host", amount); addPoints(state, "guest", amount); }
function memoryPairs(state: RoomState) { return Object.values(state.memoryNotes).filter((notes) => notes.host && notes.guest).length; }
function actionFrom(value: unknown): RoomAction | null {
  if (!isRecord(value) || typeof value.type !== "string") return null;
  if (["arrive", "advanceLobby", "advanceQuiz", "clearDrawing", "advanceDrawing", "advanceMemory", "setFinaleReady", "advanceFinale"].includes(value.type)) return { type: value.type } as RoomAction;
  if (value.type === "answerQuiz" && typeof value.answer === "string") return { type: value.type, answer: value.answer };
  if (value.type === "addStroke" && validStroke(value.stroke)) return { type: value.type, stroke: value.stroke };
  if (value.type === "submitGuess" && typeof value.guess === "string") return { type: value.type, guess: value.guess };
  if (value.type === "saveMemoryNote" && typeof value.note === "string") return { type: value.type, note: value.note };
  if (value.type === "restart" && (value.mode === "fresh" || value.mode === "save")) return { type: value.type, mode: value.mode };
  return null;
}

function apply(state: RoomState, role: Role, action: RoomAction): string | null {
  const notices: string[] = [];
  const hostOnly = ["advanceLobby", "advanceQuiz", "advanceDrawing", "advanceMemory", "advanceFinale", "restart"];
  if (hostOnly.includes(action.type) && role !== "host") throw new Error("Only the host can move to the next chapter.");
  switch (action.type) {
    case "arrive": { const key = role === "host" ? "hostPresent" : "guestPresent"; if (state[key]) return null; state[key] = true; if (!state.firstArrival) { state.firstArrival = role; unlock(state, "earlyBird", notices); } break; }
    case "advanceLobby": if (state.stage !== "lobby") throw new Error("The lobby has already finished."); if (!state.hostPresent || !state.guestPresent) throw new Error("Waiting for both of you to arrive."); state.stage = "quiz"; addBoth(state, 1); break;
    case "answerQuiz": { if (state.stage !== "quiz" || state.answers[String(state.quizIndex)]?.[role]) throw new Error("That answer is already locked."); if (!content.quiz[state.quizIndex].options.includes(action.answer)) throw new Error("That answer is not available."); state.answers[String(state.quizIndex)] = { ...state.answers[String(state.quizIndex)], [role]: action.answer }; break; }
    case "advanceQuiz": { const answers = state.answers[String(state.quizIndex)]; if (state.stage !== "quiz" || !answers?.host || !answers.guest) throw new Error("Waiting for both answers."); if (answers.host === answers.guest) { state.matchedQuizAnswers += 1; addBoth(state, 2); if (state.matchedQuizAnswers >= 3) unlock(state, "quizMaster", notices); } if (state.quizIndex < content.quiz.length - 1) state.quizIndex += 1; else { state.stage = "draw"; state.surprises.quiz = true; addBoth(state, 1); notices.push(content.surprises.quiz.message); } break; }
    case "addStroke": if (state.stage !== "draw" || role !== state.drawer) throw new Error("It is not your turn to draw."); if (state.strokes.length >= 100) throw new Error("That canvas is full, try the next round."); state.strokes.push(action.stroke); break;
    case "clearDrawing": if (state.stage !== "draw" || role !== state.drawer) throw new Error("Only the current artist can clear the canvas."); state.strokes = []; break;
    case "submitGuess": { const guess = action.guess.trim(); if (state.stage !== "draw" || role === state.drawer || !guess || guess.length > 120) throw new Error("That guess cannot be sent."); state.guesses = [...state.guesses, guess].slice(-20); break; }
    case "advanceDrawing": if (state.stage !== "draw") throw new Error("The sketchbook is not open."); state.completedDrawRounds += 1; addPoints(state, state.drawer, 2); unlock(state, "artisticSoul", notices); if (state.drawRound < 3) { state.drawRound += 1; state.drawer = state.drawer === "host" ? "guest" : "host"; state.strokes = []; state.guesses = []; } else { state.stage = "memories"; state.surprises.draw = true; addBoth(state, 1); notices.push(content.surprises.draw.message); } break;
    case "saveMemoryNote": { const note = action.note.trim(); if (state.stage !== "memories" || !note || note.length > 280 || state.memoryNotes[String(state.memoryIndex)]?.[role]) throw new Error("That note is already saved."); state.memoryNotes[String(state.memoryIndex)] = { ...state.memoryNotes[String(state.memoryIndex)], [role]: note }; addPoints(state, role, 1); if (memoryPairs(state) >= 3) unlock(state, "memoryPalace", notices); break; }
    case "advanceMemory": { const notes = state.memoryNotes[String(state.memoryIndex)]; if (state.stage !== "memories" || !notes?.host || !notes.guest) throw new Error("Add both notes before continuing."); if (state.memoryIndex < content.memories.length - 1) state.memoryIndex += 1; else { state.stage = "finale"; state.surprises.memory = true; addBoth(state, 1); notices.push(content.surprises.memory.message); } break; }
    case "setFinaleReady": if (state.ready[role]) return null; if (state.stage !== "finale") throw new Error("The final envelope is not ready yet."); state.ready[role] = true; state.finaleUnlocked = state.ready.host && state.ready.guest; if (state.finaleUnlocked) addBoth(state, 1); break;
    case "advanceFinale": if (state.stage !== "finale" || !state.finaleUnlocked) throw new Error("Open the envelope together first."); state.stage = "ending"; break;
    case "restart": { if (state.stage !== "ending") throw new Error("Finish the evening before replaying."); const revision = state.revision; const keepsakes = action.mode === "save" ? [...state.keepsakes.slice(-4), { savedAt: new Date().toISOString(), lovePoints: state.lovePoints, achievements: state.achievements, memoryNotes: state.memoryNotes }] : state.keepsakes; const next = freshState(true, state.guestPresent, keepsakes); Object.assign(state, next, { revision }); break; }
  }
  state.revision += 1;
  return notices.join(" ") || null;
}

export async function GET(req: Request) { const url = new URL(req.url); const role = url.searchParams.get("role"); const token = url.searchParams.get("token"); if (!auth(role, token)) return error("This invitation link is not valid.", 401); return Response.json(response(await load(), role), { headers: { "cache-control": "no-store" } }); }
export async function POST(req: Request) {
  const body: unknown = await req.json().catch(() => null);
  if (!isRecord(body)) return error("Invalid request.", 400);
  const role = typeof body.role === "string" ? body.role : null;
  if (!auth(role, typeof body.token === "string" ? body.token : null)) return error("Not invited", 401);
  const action = actionFrom(body.action);
  if (!action || !Number.isSafeInteger(body.expectedRevision)) return error("Invalid room action.", 400);
  await load();
  const db = getDb();
  const row = await db.select().from(rooms).where(eq(rooms.id, ROOM_ID)).get();
  if (!row) return error("Room unavailable.", 503);
  const state = normalize(JSON.parse(row.state));
  if (body.expectedRevision !== state.revision) return Response.json(response(state, role), { status: 409 });
  let notice: string | null;
  try { notice = apply(state, role, action); } catch (cause) {
    return error(cause instanceof Error ? cause.message : "Invalid action.", 400);
  }
  // Compare the exact stored snapshot atomically: only one concurrent writer wins.
  const changed = await db.update(rooms).set({ state: JSON.stringify(state), updatedAt: new Date() })
    .where(and(eq(rooms.id, ROOM_ID), eq(rooms.state, row.state))).returning({ id: rooms.id });
  if (!changed.length) return Response.json(response(await load(), role), { status: 409 });
  return Response.json(response(state, role, notice ?? undefined), { headers: { "cache-control": "no-store" } });
}
