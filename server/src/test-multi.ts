import { io as ioClient, Socket } from "socket.io-client";

async function main() {
  const URL = process.env.SERVER_URL ?? "http://localhost:3001";
  console.log(`connecting to ${URL} ...`);

  const mk = (name: string) =>
    ioClient(URL, { transports: ["websocket"], reconnection: false });

  const a: Socket = mk("A");
  const b: Socket = mk("B");
  const c: Socket = mk("C");

  const waitFor = (s: Socket, ev: string) =>
    new Promise<any>((res) => s.once(ev, res));

  // A joins (attach listener for B's arrival BEFORE B joins to avoid race)
  const sawBPromise = new Promise<any>((res) => {
    const t = setTimeout(() => res(null), 3000);
    a.once("playerJoined", (d: any) => {
      clearTimeout(t);
      res(d);
    });
  });
  a.emit("join", { name: "Harsh", avatarId: "glasses" });
  const initA = await waitFor(a, "init");
  console.log("A init players:", initA.players.length, "chairs:", initA.chairs.length);

  b.emit("join", { name: "Rahul", avatarId: "bearded" });
  const initB = await waitFor(b, "init");
  console.log("B init players:", initB.players.length);

  const joinedOnA = await sawBPromise;
  console.log("A saw join:", joinedOnA?.player?.name ?? "MISSED (non-fatal)");

  c.emit("join", { name: "Akshay", avatarId: "cool" });
  await waitFor(c, "init");
  console.log("C joined");

  // movement sync: A moves, B should see
  const movedP = waitFor(b, "playerMoved");
  a.emit("move", { x: 1.5, z: 2.5, rotY: 1.2, activity: "WALKING" });
  const moved = await movedP;
  console.log("B saw A move:", moved.x === 1.5 && moved.z === 2.5 ? "OK" : "FAIL", moved);

  // queue: subscribe BEFORE joining so we don't miss instant assignment
  const qUpdates: any[] = [];
  const chairStates: any[] = [];
  const turns: string[] = [];
  for (const s of [a, b, c]) {
    s.on("queueUpdate", (q: any) => qUpdates.push(q));
    s.on("chairUpdate", (d: any) => chairStates.push(d));
    s.on("yourTurn", (d: any) => turns.push(`${s.id}:${d.chairId}`));
  }

  a.emit("joinQueue");
  b.emit("joinQueue");
  c.emit("joinQueue");
  await new Promise((r) => setTimeout(r, 1200));
  const last = qUpdates[qUpdates.length - 1];
  console.log("queue count (expect 0, chairs were free):", last?.count);
  console.log("yourTurn events (expect 3):", turns.length, turns.join(" "));
  const lastChairs = chairStates[chairStates.length - 1];
  const occupied = lastChairs?.chairs.filter((ch: any) => ch.state !== "AVAILABLE").length ?? -1;
  console.log("occupied chairs (expect 3):", occupied, occupied === 3 ? "OK" : "FAIL");

  // A selects haircut on its chair — find chair occupied by A from snapshot
  const myId = (initA as any).playerId as string;
  const aChair = lastChairs?.chairs.find((ch: any) => ch.occupantId === myId);
  console.log("A chair:", aChair?.id ?? "none");
  if (aChair) {
    a.emit("selectHaircut", { chairId: aChair.id, type: "normal" });
    await new Promise((r) => setTimeout(r, 600));
    console.log("selectHaircut sent OK");
  }

  // chat sync
  const chatP = waitFor(b, "chatMessage");
  a.emit("chat", { text: "bhai kitna wait hai?" });
  const chat = await chatP;
  console.log("chat sync:", chat.text.includes("wait") ? "OK" : "FAIL", chat);

  // double-booking check: B tries to select A's chair (should get errorMessage)
  if (aChair) {
    const errP = waitFor(b, "errorMessage");
    b.emit("selectHaircut", { chairId: aChair.id, type: "fade" });
    const err = await Promise.race([
      errP,
      new Promise((r) => setTimeout(() => r(null), 800)),
    ]);
    console.log("double-book guard:", err ? "OK" : "FAIL");
  }

  // disconnect removes player
  const leftP = waitFor(b, "playerLeft");
  c.disconnect();
  const left = await leftP;
  console.log("disconnect sync:", left.playerId ? "OK" : "FAIL");

  a.disconnect();
  b.disconnect();
  console.log("ALL MULTIPLAYER CHECKS DONE");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
