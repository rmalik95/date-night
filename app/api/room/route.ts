import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { rooms } from "@/db/schema";
import content from "@/content/date-night.json";

const TOKENS = { host: "rishabh-host-3years", guest: "glyra-guest-3years" } as const;
const initial = { stage:"lobby",hostPresent:false,guestPresent:false,quizIndex:0,answers:{},quizScore:0,drawRound:0,drawer:"host",strokes:[],guesses:[],drawScore:0,memoryIndex:0,ready:{host:false,guest:false},finaleUnlocked:false };
function auth(role:string|null,token:string|null): role is keyof typeof TOKENS { return (role==="host"||role==="guest") && token===TOKENS[role]; }
async function load() { const db=getDb(); const row=await db.select().from(rooms).where(eq(rooms.id,"anniversary")).get(); if(row)return JSON.parse(row.state); await db.insert(rooms).values({id:"anniversary",state:JSON.stringify(initial),updatedAt:new Date()}); return initial; }
function response(state:any) { return { state, ...(state.finaleUnlocked ? { secret:{letter:content.letter,date:content.futureDate} } : {}) }; }
export async function GET(req:Request) { const u=new URL(req.url); if(!auth(u.searchParams.get("role"),u.searchParams.get("token")))return Response.json({error:"This invitation link is not valid."},{status:401}); return Response.json(response(await load()),{headers:{"cache-control":"no-store"}}); }
export async function POST(req:Request) { const body=await req.json() as {role:string,token:string,patch:Record<string,unknown>}; if(!auth(body.role,body.token))return Response.json({error:"Not invited"},{status:401}); const state=await load(); const hostOnly=["stage","quizIndex","quizScore","drawRound","drawer","drawScore","memoryIndex"]; if(body.role!=="host"&&hostOnly.some(k=>k in body.patch))return Response.json({error:"Host action required"},{status:403}); const safe={...body.patch}; delete safe.hostPresent; delete safe.guestPresent; if("finaleUnlocked" in safe) { const ready=(safe.ready||state.ready) as {host?:boolean;guest?:boolean}; safe.finaleUnlocked=Boolean(ready.host&&ready.guest); } const next={...state,...safe,[body.role==="host"?"hostPresent":"guestPresent"]:true}; const db=getDb(); await db.update(rooms).set({state:JSON.stringify(next),updatedAt:new Date()}).where(eq(rooms.id,"anniversary")); return Response.json(response(next)); }
