import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server, Socket } from "socket.io";

// ---------- Types ----------
export type Activity = "WALKING" | "IDLE" | "WAITING" | "GETTING_HAIRCUT" | "SITTING";
export type ChairState = "AVAILABLE" | "OCCUPIED" | "CUTTING" | "FINISHED";

export interface Player {
  id: string;
  name: string;
  avatarId: string;
  x: number;
  z: number;
  rotY: number;
  activity: Activity;
  chairId: number | null;
  haircut: string | null;
  emote: string | null;
  joinedAt: number;
}

export interface Chair {
  id: number;
  state: ChairState;
  occupantId: string | null;
  haircutType: string | null;
  startedAt: number | null;
  endsAt: number | null;
}

export interface QueueEntry {
  id: string;
  name: string;
  avatarId: string;
}

// MVP compressed durations (seconds) — displayed as "real" salon minutes in UI
export const HAIRCUT_DURATIONS: Record<string, number> = {
  normal: 30,
  fade: 45,
  "hair-beard": 60,
  massage: 60,
  bhaiya: 45,
};

export const AVG_SERVICE_SEC = 45;

const MAX_PLAYERS = 50;

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

const players = new Map<string, Player>();
let queue: string[] = []; // socket ids, server-authoritative
const chairs: Chair[] = [0, 1, 2, 3, 4].map((id) => ({
  id,
  state: "AVAILABLE",
  occupantId: null,
  haircutType: null,
  startedAt: null,
  endsAt: null,
}));

// Mock agent state per player (server keeps latest; simulated progress ticks)
interface AgentState {
  playerId: string;
  task: string;
  status: "IDLE" | "WORKING" | "WAITING" | "COMPLETED" | "FAILED";
  progress: number;
  etaSec: number;
  /** Which AI is doing the work: "ChatGPT" | "Antigravity" | "Claude Code" | ... | "Salon Sim" */
  provider: string;
}
const agents = new Map<string, AgentState>();
const AGENT_TASKS = [
  "Refactoring authentication",
  "Fixing flaky tests",
  "Migrating to TypeScript",
  "Optimizing DB queries",
  "Deploying to staging",
  "Reviewing PR #482",
  "Writing docs nobody reads",
];

function spawnPoint(index: number): { x: number; z: number } {
  // Spread spawns near the entrance (bigger room now)
  const spots = [
    { x: 0, z: 9.8 },
    { x: -2.5, z: 9.8 },
    { x: 2.5, z: 9.8 },
    { x: -5, z: 9 },
    { x: 5, z: 9 },
    { x: -7, z: 8.5 },
    { x: 7, z: 8.5 },
    { x: 0, z: 6.8 },
  ];
  return spots[index % spots.length];
}

function queueSnapshot(): QueueEntry[] {
  return queue
    .map((id) => players.get(id))
    .filter((p): p is Player => !!p)
    .map((p) => ({ id: p.id, name: p.name, avatarId: p.avatarId }));
}

function chairsSnapshot(): Chair[] {
  return chairs.map((c) => ({ ...c }));
}

function estimatedWaitSec(positionIndex: number): number {
  // positionIndex 0-based. Chairs work in parallel (5 chairs).
  // Rough: batches of 5, each batch AVG_SERVICE_SEC.
  const batchesAhead = Math.floor(positionIndex / 5);
  const cuttingRemaining = chairs
    .filter((c) => c.state === "CUTTING" && c.endsAt)
    .map((c) => Math.max(0, ((c.endsAt as number) - Date.now()) / 1000));
  const soonestFree =
    chairs.some((c) => c.state === "AVAILABLE")
      ? 0
      : cuttingRemaining.length
        ? Math.min(...cuttingRemaining)
        : AVG_SERVICE_SEC;
  return Math.round(batchesAhead * AVG_SERVICE_SEC + soonestFree);
}

function broadcastQueue() {
  const snap = queueSnapshot();
  const withWaits = snap.map((q, i) => ({
    ...q,
    position: i + 1,
    estWaitSec: estimatedWaitSec(i),
  }));
  io.emit("queueUpdate", { queue: withWaits, count: withWaits.length });
}

function broadcastChairs() {
  io.emit("chairUpdate", { chairs: chairsSnapshot() });
}

function broadcastOnline() {
  io.emit("onlineCount", { count: players.size });
}

function tryAssignChairs() {
  // Assign free chairs to head of queue
  for (const chair of chairs) {
    if (chair.state !== "AVAILABLE") continue;
    // find first queued player not already seated/assigned
    const nextId = queue[0];
    if (!nextId) break;
    const p = players.get(nextId);
    if (!p) {
      queue.shift();
      continue;
    }
    if (p.chairId !== null) {
      queue.shift();
      continue;
    }
    // assign: remove from queue, mark chair OCCUPIED, notify player
    queue.shift();
    chair.state = "OCCUPIED";
    chair.occupantId = p.id;
    chair.haircutType = null;
    p.chairId = chair.id;
    p.activity = "GETTING_HAIRCUT";
    io.to(p.id).emit("yourTurn", { chairId: chair.id });
    io.emit("playerStatus", {
      playerId: p.id,
      activity: p.activity,
      chairId: p.chairId,
    });
    io.emit("chatMessage", {
      from: "Bhaiya",
      text: `${p.name}, chair no. ${chair.id + 1} khaali hai! Aa jao boss! 💈`,
      ts: Date.now(),
      system: true,
    });
  }
  broadcastQueue();
  broadcastChairs();
}

function sanitizeName(raw: unknown): string {
  let s = String(raw ?? "Guest").slice(0, 16).trim();
  if (!s) s = "Guest";
  // strip control chars
  s = s.replace(/[\u0000-\u001F\u007F]/g, "");
  return s || "Guest";
}

const VALID_AVATARS = new Set([
  "glasses",
  "casual",
  "bearded",
  "cool",
  "nerd",
  "bald",
  "female",
  "generic",
  "robot",
]);

io.on("connection", (socket: Socket) => {
  if (players.size >= MAX_PLAYERS) {
    socket.emit("roomFull", {
      message: "Salon full hai boss! Thoda wait karo. (Room full, try again soon)",
    });
    socket.disconnect(true);
    return;
  }

  console.log(`+ ${socket.id} connected (${players.size + 1} online)`);

  socket.on("join", (data: { name?: string; avatarId?: string }) => {
    const name = sanitizeName(data?.name);
    const avatarId = VALID_AVATARS.has(String(data?.avatarId))
      ? String(data.avatarId)
      : "generic";
    const idx = players.size;
    const spawn = spawnPoint(idx);
    const player: Player = {
      id: socket.id,
      name,
      avatarId,
      x: spawn.x,
      z: spawn.z,
      rotY: Math.PI,
      activity: "IDLE",
      chairId: null,
      haircut: null,
      emote: null,
      joinedAt: Date.now(),
    };
    players.set(socket.id, player);
    const task =
      AGENT_TASKS[Math.floor(Math.random() * AGENT_TASKS.length)];
    agents.set(socket.id, {
      playerId: socket.id,
      task,
      status: "WORKING",
      progress: Math.floor(Math.random() * 20),
      etaSec: 120 + Math.floor(Math.random() * 180),
      provider: "Salon Sim",
    });

    // send init to new player
    socket.emit("init", {
      playerId: socket.id,
      players: [...players.values()],
      queue: queueSnapshot(),
      chairs: chairsSnapshot(),
      agent: agents.get(socket.id),
    });
    // notify others
    socket.broadcast.emit("playerJoined", { player });
    socket.broadcast.emit("agentBroadcast", {
      playerId: socket.id,
      agent: agents.get(socket.id),
    });
    broadcastOnline();
    broadcastQueue();
    broadcastChairs();
    io.emit("chatMessage", {
      from: "Salon",
      text: `${name} entered the salon. Namaste! 🙏`,
      ts: Date.now(),
      system: true,
    });
  });

  socket.on("move", (data: { x?: number; z?: number; rotY?: number; activity?: Activity }) => {
    const p = players.get(socket.id);
    if (!p) return;
    // region-aware clamp (salon vs club); region decided from incoming coords
    // so portal teleports land instead of being clamped back
    const club = typeof data.x === "number" ? data.x > 25 : p.x > 25;
    if (typeof data.x === "number")
      p.x = club ? Math.max(28.4, Math.min(51.6, data.x)) : Math.max(-12, Math.min(12, data.x));
    if (typeof data.z === "number")
      p.z = club ? Math.max(-7.6, Math.min(9.6, data.z)) : Math.max(-8.4, Math.min(10.4, data.z));
    if (typeof data.rotY === "number") p.rotY = data.rotY;
    if (data.activity) p.activity = data.activity;
    socket.broadcast.emit("playerMoved", {
      playerId: p.id,
      x: p.x,
      z: p.z,
      rotY: p.rotY,
      activity: p.activity,
    });
  });

  socket.on("joinQueue", () => {
    const p = players.get(socket.id);
    if (!p) return;
    if (queue.includes(socket.id)) return;
    if (p.chairId !== null) return; // already seated
    queue.push(socket.id);
    p.activity = "WAITING";
    io.emit("playerStatus", {
      playerId: p.id,
      activity: p.activity,
      chairId: p.chairId,
    });
    broadcastQueue();
    tryAssignChairs();
  });

  socket.on("leaveQueue", () => {
    const p = players.get(socket.id);
    if (!p) return;
    queue = queue.filter((id) => id !== socket.id);
    if (p.activity === "WAITING") p.activity = "IDLE";
    broadcastQueue();
  });

  socket.on("selectHaircut", (data: { chairId?: number; type?: string }) => {
    const p = players.get(socket.id);
    if (!p) return;
    const chairId = Number(data?.chairId);
    const type = String(data?.type ?? "normal");
    const chair = chairs[chairId];
    if (!chair || chair.occupantId !== socket.id) {
      socket.emit("errorMessage", { message: "Ye chair tumhari nahi hai boss!" });
      return;
    }
    if (chair.state !== "OCCUPIED") return;
    const dur = HAIRCUT_DURATIONS[type] ?? 30;
    chair.state = "CUTTING";
    chair.haircutType = type;
    chair.startedAt = Date.now();
    chair.endsAt = Date.now() + dur * 1000;
    p.haircut = type;
    broadcastChairs();
    io.emit("playerStatus", {
      playerId: p.id,
      activity: p.activity,
      haircut: type,
      chairId: p.chairId,
    });
    io.emit("barberDialogue", {
      chairId,
      text: barberLine("start"),
    });
  });

  socket.on("leaveChair", () => {
    const p = players.get(socket.id);
    if (!p || p.chairId === null) return;
    freeChair(p.chairId, false);
  });

  socket.on("chat", (data: { text?: string }) => {
    const p = players.get(socket.id);
    if (!p) return;
    const text = String(data?.text ?? "").slice(0, 200).trim();
    if (!text) return;
    io.emit("chatMessage", {
      from: p.name,
      playerId: p.id,
      text,
      ts: Date.now(),
    });
  });

  socket.on("emote", (data: { emote?: string }) => {
    const p = players.get(socket.id);
    if (!p) return;
    const allowed = ["laugh", "wave", "dance", "thumbs", "d1", "d2", "d3", "d4", "d5"];
    const em = String(data?.emote ?? "");
    if (!allowed.includes(em)) return;
    p.emote = em;
    io.emit("playerEmote", { playerId: p.id, emote: em });
    setTimeout(() => {
      const cur = players.get(socket.id);
      if (cur && cur.emote === em) {
        cur.emote = null;
        io.emit("playerEmote", { playerId: socket.id, emote: null });
      }
    }, 3000);
  });

  socket.on("agentPing", (data: { progress?: number; status?: string }) => {
    // Allow client-simulated agent to sync (MVP). Validated lightly.
    const a = agents.get(socket.id);
    if (!a) return;
    if (typeof data?.progress === "number")
      a.progress = Math.max(0, Math.min(100, data.progress));
    if (typeof data?.status === "string") {
      const s = data.status.toUpperCase();
      if (["IDLE", "WORKING", "WAITING", "COMPLETED", "FAILED"].includes(s))
        a.status = s as AgentState["status"];
    }
    socket.emit("agentUpdate", { agent: a });
  });

  socket.on("disconnect", () => {
    const p = players.get(socket.id);
    console.log(`- ${socket.id} disconnected`);
    // remove from queue
    queue = queue.filter((id) => id !== socket.id);
    // free chair if seated
    if (p?.chairId !== null && p?.chairId !== undefined) {
      const c = chairs[p.chairId];
      if (c && c.occupantId === socket.id) {
        c.state = "AVAILABLE";
        c.occupantId = null;
        c.haircutType = null;
        c.startedAt = null;
        c.endsAt = null;
      }
    }
    players.delete(socket.id);
    agents.delete(socket.id);
    io.emit("playerLeft", { playerId: socket.id });
    if (p) {
      io.emit("chatMessage", {
        from: "Salon",
        text: `${p.name} left. Phir aana boss! 👋`,
        ts: Date.now(),
        system: true,
      });
    }
    broadcastQueue();
    broadcastChairs();
    broadcastOnline();
    tryAssignChairs();
  });
});

function freeChair(chairId: number, completed: boolean) {
  const chair = chairs[chairId];
  if (!chair) return;
  const occ = chair.occupantId ? players.get(chair.occupantId) : undefined;
  chair.state = "AVAILABLE";
  chair.occupantId = null;
  chair.haircutType = null;
  chair.startedAt = null;
  chair.endsAt = null;
  if (occ) {
    occ.chairId = null;
    occ.haircut = null;
    occ.activity = "IDLE";
    // move player in front of chair so they don't clip
    occ.z = Math.min(9, occ.z + 1.5);
    io.to(occ.id).emit("haircutDone", { chairId, completed });
    io.emit("playerStatus", {
      playerId: occ.id,
      activity: occ.activity,
      chairId: null,
    });
    io.emit("playerMoved", {
      playerId: occ.id,
      x: occ.x,
      z: occ.z,
      rotY: occ.rotY,
      activity: occ.activity,
    });
  }
  broadcastChairs();
  broadcastQueue();
  tryAssignChairs();
}

function barberLine(kind: "start" | "mid" | "done"): string {
  const starts = [
    "Kya haircut karna hai boss?",
    "Side thoda chhota?",
    "Machine lagau?",
    "Beard bhi kar du?",
    "Bhaiya normal hi rakhna?",
  ];
  const mids = [
    "Ek dum hero lagoge boss!",
    "Side thoda aur chhota kar du?",
    "Aur thoda trim kar du?",
    "Relax karo, cutting chal rahi hai...",
  ];
  const dones = [
    "Ho gaya boss!",
    "Mirror mein dekh lo!",
    "Ek dum fresh! 💈",
  ];
  const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];
  if (kind === "start") return pick(starts);
  if (kind === "mid") return pick(mids);
  return pick(dones);
}

// Tick: complete finished haircuts, advance queue, simulate agents
setInterval(() => {
  const now = Date.now();
  let changed = false;
  for (const chair of chairs) {
    if (chair.state === "CUTTING" && chair.endsAt && now >= chair.endsAt) {
      chair.state = "FINISHED";
      changed = true;
      io.emit("barberDialogue", { chairId: chair.id, text: barberLine("done") });
      io.to(chair.occupantId ?? "").emit("haircutFinishing", {
        chairId: chair.id,
      });
      // auto-free after 5s
      setTimeout(() => {
        if (chair.state === "FINISHED") freeChair(chair.id, true);
      }, 5000);
    } else if (chair.state === "CUTTING" && Math.random() < 0.06) {
      io.emit("barberDialogue", { chairId: chair.id, text: barberLine("mid") });
    }
  }
  if (changed) {
    broadcastChairs();
    tryAssignChairs();
  }
}, 1000);

// Agent simulation tick: progress WORKING agents + broadcast so EVERYONE
// can see each other's provider / progress live above their heads.
setInterval(() => {
  for (const a of agents.values()) {
    if (a.status === "WORKING") {
      a.progress = Math.min(100, a.progress + Math.random() * 2.5);
      a.etaSec = Math.max(0, a.etaSec - 5);
      io.emit("agentBroadcast", { playerId: a.playerId, agent: { ...a } });
      if (a.progress >= 100) {
        a.status = "COMPLETED";
        io.to(a.playerId).emit("agentUpdate", { agent: { ...a } });
        io.emit("agentBroadcast", { playerId: a.playerId, agent: { ...a } });
        io.to(a.playerId).emit("chatMessage", {
          from: "AI Agent 🤖",
          text: "Task complete boss! Deploy ho gaya. 🎉",
          ts: Date.now(),
          system: true,
        });
      }
    }
  }
}, 5000);

// ---------- REST ----------
app.get("/health", (_req, res) => {
  res.json({ ok: true, players: players.size, queue: queue.length });
});

app.get("/api/online", (_req, res) => {
  res.json({ count: players.size });
});

// Future AI-agent integration webhook:
// POST /api/agent/:playerId { status, task, progress }
function applyAgentUpdate(playerId: string, body: any) {
  const a = agents.get(playerId);
  if (!a) return null;
  const { status, task, progress, etaSec, provider } = body ?? {};
  if (typeof task === "string" && task.length) a.task = task.slice(0, 120);
  if (typeof progress === "number")
    a.progress = Math.max(0, Math.min(100, progress));
  if (typeof etaSec === "number") a.etaSec = Math.max(0, etaSec);
  if (typeof provider === "string" && provider.trim().length)
    a.provider = provider.slice(0, 24);
  if (typeof status === "string") {
    const s = status.toUpperCase();
    if (["IDLE", "WORKING", "WAITING", "COMPLETED", "FAILED"].includes(s))
      a.status = s as AgentStatus;
  }
  io.to(playerId).emit("agentUpdate", { agent: { ...a } });
  io.emit("agentBroadcast", { playerId, agent: { ...a } });
  return a;
}

type AgentStatus = "IDLE" | "WORKING" | "WAITING" | "COMPLETED" | "FAILED";

app.post("/api/agent/:playerId", (req, res) => {
  const a = applyAgentUpdate(req.params.playerId, req.body);
  if (!a) return res.status(404).json({ error: "player not found" });
  res.json({ ok: true, agent: a });
});

// Real-agent hookup by display name (for CLIs/hooks that don't know socket IDs).
// Example: curl -X POST localhost:3001/api/agent/by-name/Harsh -H 'Content-Type: application/json'
//          -d '{"status":"working","task":"Refactoring auth","progress":42}'
app.post("/api/agent/by-name/:name", (req, res) => {
  const want = decodeURIComponent(req.params.name).toLowerCase();
  const entry = [...players.values()].find((p) => p.name.toLowerCase() === want);
  if (!entry) return res.status(404).json({ error: "no online player with that name" });
  const a = applyAgentUpdate(entry.id, req.body);
  res.json({ ok: true, agent: a });
});

app.get("/api/players", (_req, res) => {
  res.json({
    players: [...players.values()].map((p) => ({
      id: p.id,
      name: p.name,
      avatarId: p.avatarId,
      activity: p.activity,
      x: Math.round(p.x * 100) / 100,
      z: Math.round(p.z * 100) / 100,
      chairId: p.chairId,
    })),
  });
});

const PORT = Number(process.env.PORT ?? 3001);
httpServer.listen(PORT, () => {
  console.log(`💈 Salon server listening on :${PORT}`);
});
