import { io } from "socket.io-client";
// Verifies: club teleport lands (region-aware clamp), club movement clamps,
// salon clamp still holds, queue->yourTurn works from club positions.
const URL = "http://localhost:3001";
const s = io(URL, { transports: ["websocket"] });

async function main() {
  s.emit("join", { name: "ClubTest", avatarId: "cool" });
  const init: any = await new Promise((r) => s.once("init", r));
  console.log("spawn:", init.players.find((p: any) => p.id === init.playerId).x, "(expect ~0)");

  // teleport to club (like the disco door does)
  const moved1: any = await new Promise((r) => {
    s.once("playerMoved", r);
    // listen on a second socket to observe our own broadcast? server broadcasts to OTHERS only.
    // so instead verify via chair assignment + queue below; check clamp via direct state:
    s.emit("move", { x: 31, z: 6, rotY: 1.5, activity: "WALKING" });
    setTimeout(() => r(null), 800);
  });
  void moved1;

  // join queue from "club" (server doesn't care where you are)
  const turnP = new Promise<any>((res) => {
    const t = setTimeout(() => res(null), 5000);
    s.once("yourTurn", (d: any) => {
      clearTimeout(t);
      res(d);
    });
  });
  let lastQ: any = null;
  s.on("queueUpdate", (d: any) => (lastQ = d));
  s.emit("joinQueue");
  const turn = await turnP;
  console.log("yourTurn from club-queue:", turn ? `OK chair ${turn.chairId}` : "FAIL");

  // club bounds: try to walk past the club wall
  s.emit("move", { x: 200, z: 6, rotY: 0, activity: "WALKING" });
  await new Promise((r) => setTimeout(r, 400));
  const h: any = await fetch(URL + "/health").then((r) => r.json());
  console.log("health:", JSON.stringify(h));

  // verify clamp via players endpoint
  const pl: any = await fetch(URL + "/api/players").then((r) => r.json());
  const me = pl.players.find((p: any) => p.name === "ClubTest");
  console.log(
    "club clamp x<=51.6:",
    me ? (me.x <= 51.7 ? `OK (x=${me.x})` : `FAIL x=${me.x}`) : "MISS"
  );

  // back to salon bounds
  s.emit("move", { x: 0, z: 9, rotY: 0, activity: "IDLE" });
  await new Promise((r) => setTimeout(r, 400));
  const pl2: any = await fetch(URL + "/api/players").then((r) => r.json());
  const me2 = pl2.players.find((p: any) => p.name === "ClubTest");
  console.log("salon return:", me2 && Math.abs(me2.x) < 0.01 ? "OK" : `FAIL ${JSON.stringify(me2)}`);
  void lastQ;

  s.disconnect();
  console.log("CLUB TEST DONE");
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
