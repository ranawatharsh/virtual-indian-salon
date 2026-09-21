// salon-agent: wraps ANY real command and mirrors its lifecycle to the salon.
// The salon panel then shows YOUR actual work, not a simulation.
//
//   Wrap a command:
//     npx tsx src/agent-cli.ts --name Harsh --task "Refactoring auth" -- npm run build
//
//   One-shot update (for hooks / scripts / CI):
//     npx tsx src/agent-cli.ts --name Harsh --once --status working --task "Fixing tests" --progress 40
//
// Env equivalents: SALON_SERVER, SALON_NAME, SALON_TASK.
import { spawn } from "child_process";

const args = process.argv.slice(2);
function opt(name: string, def = ""): string {
  const i = args.indexOf(name);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : def;
}

const SERVER = process.env.SALON_SERVER ?? opt("--server", "http://localhost:3001");
const NAME = process.env.SALON_NAME ?? opt("--name", "");
const TASK = process.env.SALON_TASK ?? opt("--task", "Working");
const PROVIDER = process.env.SALON_PROVIDER ?? opt("--provider", "Terminal");
const ONCE = args.includes("--once");
const STATUS = opt("--status", "working");
const PROG = Number(opt("--progress", "50"));

async function post(body: unknown): Promise<void> {
  const r = await fetch(`${SERVER}/api/agent/by-name/${encodeURIComponent(NAME)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider: PROVIDER, ...(body as Record<string, unknown>) }),
  });
  if (!r.ok) throw new Error(`salon server ${r.status}: ${await r.text()}`);
}

async function main() {
  if (!NAME) {
    console.error('salon-agent: --name "YourSalonName" is required (must match your in-salon name)');
    process.exit(2);
  }
  if (ONCE) {
    await post({ status: STATUS, task: TASK, progress: PROG });
    console.log(`💈 salon: posted ${STATUS} for ${NAME}`);
    return;
  }
  const KNOWN = new Set(["--name", "--task", "--server", "--status", "--progress"]);
  let sep = args.indexOf("--");
  let cmd: string[];
  if (sep >= 0) {
    cmd = args.slice(sep + 1);
  } else {
    // fallback: first token that isn't a known flag (or its value) starts the command
    cmd = [];
    for (let i = 0; i < args.length; i++) {
      const t = args[i];
      if (KNOWN.has(t)) {
        i++;
        continue;
      }
      if (t === "--once") continue;
      cmd = args.slice(i);
      break;
    }
  }
  if (!cmd.length) {
    console.error("salon-agent: wrap mode needs a command after --");
    process.exit(2);
  }
  const started = Date.now();
  await post({ status: "working", task: TASK, progress: 3, etaSec: 600 });
  console.log(`💈 salon: ${NAME} started "${TASK}"`);
  const beat = setInterval(() => {
    const el = (Date.now() - started) / 1000;
    post({
      status: "working",
      task: TASK,
      progress: Math.round(Math.min(90, 3 + el / 8)),
      etaSec: Math.max(0, Math.round(600 - el)),
    }).catch(() => {});
  }, 5000);
  const code: number = await new Promise((res) => {
    const child = spawn(cmd[0], cmd.slice(1), {
      stdio: "inherit",
      shell: process.platform === "win32",
    });
    child.on("close", (c) => res(c ?? 1));
    child.on("error", () => res(1));
  });
  clearInterval(beat);
  const done = code === 0;
  await post({ status: done ? "completed" : "failed", task: TASK, progress: done ? 100 : 50 }).catch(() => {});
  console.log(`💈 salon: ${NAME} ${done ? "COMPLETED 🎉" : "FAILED"} (exit ${code})`);
  process.exit(code);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
