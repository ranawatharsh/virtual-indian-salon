import { io } from "socket.io-client";
const URL = "http://localhost:3001";
const a = io(URL, { transports: ["websocket"] });
const b = io(URL, { transports: ["websocket"] });
const once = (s: any, ev: string) =>
  new Promise<any>((r) => {
    const t = setTimeout(() => r(null), 5000);
    s.once(ev, (d: any) => {
      clearTimeout(t);
      r(d);
    });
  });
async function main() {
  a.emit("join", { name: "ChairTestA", avatarId: "nerd" });
  const initA = await once(a, "init");
  console.log("initA:", !!initA);
  b.emit("join", { name: "ChairTestB", avatarId: "bald" });
  await once(b, "init");
  console.log("initB ok");
  let last: any = null;
  a.on("chairUpdate", (d: any) => {
    last = d;
  });
  const turnP = once(a, "yourTurn");
  a.emit("joinQueue");
  const turn = await turnP;
  console.log("yourTurn:", JSON.stringify(turn));
  await new Promise((r) => setTimeout(r, 1500));
  const mine = last.chairs.find((c: any) => c.occupantId === initA.playerId);
  console.log("assigned chair:", mine.id, mine.state);
  const cutP = new Promise<any>((res) => {
    const t = setTimeout(() => res(null), 4000);
    a.on("chairUpdate", (d: any) => {
      const c = d.chairs[mine.id];
      if (c.state === "CUTTING") {
        clearTimeout(t);
        res(c);
      }
    });
  });
  a.emit("selectHaircut", { chairId: mine.id, type: "fade" });
  const cutting = await cutP;
  console.log("cutting:", cutting ? "OK " + cutting.haircutType : "FAIL");
  const errP = once(b, "errorMessage");
  b.emit("selectHaircut", { chairId: mine.id, type: "normal" });
  const err = await Promise.race([errP, new Promise((r) => setTimeout(() => r(null), 1500))]);
  console.log("double-book blocked:", err ? "OK" : "FAIL");
  a.emit("leaveChair");
  await new Promise((r) => setTimeout(r, 1000));
  const h = await fetch(URL + "/health").then((r) => r.json());
  console.log("health:", JSON.stringify(h));
  const w: any = await fetch(URL + "/api/agent/" + initA.playerId, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "working", task: "E2E test task", progress: 72 }),
  }).then((r) => r.json());
  console.log("webhook:", w.ok ? "OK" : "FAIL");
  a.disconnect();
  b.disconnect();
  console.log("E2E CHAIR TEST DONE");
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
