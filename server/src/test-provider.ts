import { io } from "socket.io-client";
// Verifies: provider field present, cross-player agent broadcast, CLI --provider.
const URL = "http://localhost:3001";
const a = io(URL, { transports: ["websocket"] });
const b = io(URL, { transports: ["websocket"] });

async function main() {
  a.emit("join", { name: "ProvA", avatarId: "female" });
  const initA: any = await new Promise((r) => a.once("init", r));
  console.log("self provider default:", initA.agent.provider);

  b.emit("join", { name: "ProvB", avatarId: "cool" });
  await new Promise((r) => b.once("init", r));

  // B should learn A's agent via broadcast (sim tick <=5s)
  const seen = await new Promise<any>((res) => {
    const t = setTimeout(() => res(null), 8000);
    b.on("agentBroadcast", (d: any) => {
      if (d.playerId !== (initA as any).playerId) return;
      clearTimeout(t);
      res(d);
    });
  });
  console.log(
    "B sees A's agent:",
    seen ? `${seen.agent.provider} ${Math.round(seen.agent.progress)}% ${seen.agent.status}` : "MISS"
  );

  // CLI override with --provider (listener attached BEFORE the POST,
  // because the sync broadcast fires immediately)
  const seen2P = new Promise<any>((res) => {
    const t = setTimeout(() => res(null), 8000);
    const h = (d: any) => {
      if (d.agent?.provider === "Antigravity" && d.agent?.progress === 77) {
        clearTimeout(t);
        b.off("agentBroadcast", h);
        res(d);
      }
    };
    b.on("agentBroadcast", h);
  });
  const r = await fetch(URL + "/api/agent/by-name/ProvA", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider: "Antigravity", task: "Real task", progress: 77, status: "working" }),
  }).then((x) => x.json());
  console.log("provider override:", r.ok && r.agent.provider === "Antigravity" ? "OK" : "FAIL");
  const seen2 = await seen2P;
  console.log("override broadcast to other player:", seen2 ? "OK" : "FAIL");

  a.disconnect();
  b.disconnect();
  console.log("PROVIDER TEST DONE");
  process.exit(seen && seen2 ? 0 : 1);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
