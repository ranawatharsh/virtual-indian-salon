import { io } from "socket.io-client";
const s = io("http://localhost:3001", { transports: ["websocket"] });
s.emit("join", { name: "CliTest", avatarId: "nerd" });
s.on("agentUpdate", (d: any) => {
  console.log("PANEL NOW:", d.agent.status, "|", d.agent.task, "|", Math.round(d.agent.progress) + "%");
});
setTimeout(() => {
  s.disconnect();
  console.log("LISTENER DONE");
  process.exit(0);
}, 14000);
