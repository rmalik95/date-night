import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

// Run the real route against an atomic in-memory D1 stand-in without touching
// the couple's live room. The predicate verifies the exact stored JSON snapshot.
function harness() {
  let row;
  const db = {
    select: () => ({ from: () => ({ where: () => ({ get: async () => row && { ...row } }) }) }),
    insert: () => ({ values: value => ({ onConflictDoNothing: async () => { row ??= value; } }) }),
    update: () => ({ set: value => ({ where: predicate => ({
      returning: async () => {
        if (!predicate(row)) return [];
        row = { ...row, ...value }; return [{ id: row.id }];
      },
    }) }) }),
  };
  const content = JSON.parse(readFileSync(new URL("../content/date-night.json", import.meta.url)));
  const testModule = { exports: {} };
  const source = readFileSync(new URL("../app/api/room/route.ts", import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { esModuleInterop: true, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, {
    exports: testModule.exports, module: testModule, Request, Response, URL, structuredClone,
    require: name => {
      if (name === "drizzle-orm") return { eq: (key, value) => item => item[key] === value, and: (...checks) => item => checks.every(check => check(item)) };
      if (name === "@/db") return { getDb: () => db };
      if (name === "@/db/schema") return { rooms: { id: "id", state: "state" } };
      if (name === "@/content/date-night.json") return content;
      throw new Error(name);
    },
  });
  const token = role => role === "host" ? "rishabh-host-3years" : "glyra-guest-3years";
  const get = async role => (await testModule.exports.GET(new Request("http://test/api/room?role=" + role + "&token=" + token(role)))).json();
  const post = async (role, action, revision) => {
    const res = await testModule.exports.POST(new Request("http://test/api/room", { method: "POST", body: JSON.stringify({ role, token: token(role), expectedRevision: revision ?? (await get(role)).state.revision, action }) }));
    return { status: res.status, data: await res.json() };
  };
  return { get, post, content };
}

test("simultaneous clients cannot overwrite one another; conflicts can retry", async () => {
  const h = harness();
  await h.get("host");
  const results = await Promise.all([h.post("host", { type: "arrive" }, 0), h.post("guest", { type: "arrive" }, 0)]);
  assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
  const loser = results[0].status === 409 ? "host" : "guest";
  assert.equal((await h.post(loser, { type: "arrive" })).status, 200);
  const state = (await h.get("host")).state;
  assert.equal(state.hostPresent && state.guestPresent, true);
  assert.equal(state.revision, 2);
});

test("full evening: privacy, permissions, unlocks, duplicate protection and replay", async () => {
  const h = harness();
  for (const role of ["host", "guest"]) await h.post(role, { type: "arrive" });
  assert.equal((await h.post("guest", { type: "advanceLobby" })).status, 400);
  await h.post("host", { type: "advanceLobby" });
  assert.equal((await h.post("host", { type: "advanceLobby" })).status, 400);
  for (const question of h.content.quiz) {
    await h.post("host", { type: "answerQuiz", answer: question.options[0] });
    const guest = await h.get("guest");
    assert.equal(guest.state.answers[String(guest.state.quizIndex)].host, undefined);
    await h.post("guest", { type: "answerQuiz", answer: question.options[0] });
    assert.equal((await h.post("host", { type: "advanceQuiz" })).status, 200);
  }
  for (let round = 0; round < 4; round++) {
    const role = round % 2 ? "guest" : "host";
    assert.equal((await h.post(role, { type: "addStroke", stroke: { color: "#f0b75e", points: [{x:0.2,y:0.2},{x:0.4,y:0.4}] } })).status, 200);
    await h.post("host", { type: "advanceDrawing" });
  }
  for (let index = 0; index < h.content.memories.length; index++) {
    await h.post("host", { type: "saveMemoryNote", note: "Our memory" });
    assert.equal((await h.get("guest")).state.memoryNotes[index].host, undefined);
    await h.post("guest", { type: "saveMemoryNote", note: "Together" });
    await h.post("host", { type: "advanceMemory" });
  }
  await h.post("host", { type: "setFinaleReady" });
  const ready = await h.post("guest", { type: "setFinaleReady" });
  assert.equal(ready.data.state.achievements.length, 4);
  assert.ok(ready.data.secret.letter);
  const duplicate = await h.post("guest", { type: "setFinaleReady" });
  assert.deepEqual(duplicate.data.state.lovePoints, ready.data.state.lovePoints);
  await h.post("host", { type: "advanceFinale" });
  const before = (await h.get("host")).state.revision;
  const replay = await h.post("host", { type: "restart", mode: "save" });
  assert.ok(replay.data.state.revision > before);
  assert.equal(replay.data.state.keepsakes.length, 1);
  assert.deepEqual(replay.data.state.lovePoints, { host: 0, guest: 0 });
  assert.equal(replay.data.state.stage, "lobby");
});
