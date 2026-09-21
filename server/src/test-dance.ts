import { io } from "socket.io-client";
// Verifies dance-move emotes (d1..d5) sync to other players.
const URL = "http://localhost:3001";
const a = io(URL, { transports: ["websocket"] });
const b = io(URL, { transports: ["websocket"] });

async function main() {
  a.emit("join", { name: "DanceA", avatarId: "cool" });
  await new Promise((r) => a.once("init", r));
  b.emit("join", { name: "DanceB", avatarId: "female" });
  await new Promise((r) => b.once("init", r));

  const got: string[] = [];
  b.on("playerEmote", (d: any) => got.push(d.emote));
  for (const m of ["d1", "d3", "d5", "dance"]) {
    a.emit("emote", { emote: m });
    await new Promise((r) => setTimeout(r, 350));
  }
  await new Promise((r) => setTimeout(r, 500));
  const ok = ["d1", "d3", "d5", "dance"].every((m) => got.includes(m));
  console.log("dance emotes synced:", ok ? `OK (${got.join(",")})` : `FAIL (${got.join(",")})`);

  // invalid emote ignored
  const before = got.length;
  a.emit("emote", { emote: "d9" });
  await new Promise((r) => setTimeout(r, 400));
  console.log("invalid ignored:", got.length === before ? "OK" : "FAIL");

  a.disconnect();
  b.disconnect();
  console.log("DANCE TEST DONE");
  process.exit(ok ? 0 : 1);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
