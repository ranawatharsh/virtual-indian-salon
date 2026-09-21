import { useEffect, useRef, useState } from "react";
import type { AgentInfo, ChairInfo, ChatMsg, QueueItem } from "../multiplayer/socket";
import { EMOTES, HAIRCUTS, formatWait, providerIcon } from "../data";

export function Hud({
  queue,
  myId,
  agent,
  online,
  musicOn,
  sfxOn,
  playerName,
  onToggleMusic,
  onToggleSfx,
}: {
  queue: QueueItem[];
  myId: string;
  agent: AgentInfo | null;
  online: number;
  musicOn: boolean;
  sfxOn: boolean;
  playerName: string;
  onToggleMusic: () => void;
  onToggleSfx: () => void;
}) {
  const me = queue.find((q) => q.id === myId);
  const dot = !agent ? "gray" : agent.status === "WORKING" ? "green" : agent.status === "COMPLETED" ? "gold" : "red";
  return (
    <>
      <div className="hud-tl">
        <h4>💈 INDIAN SALON</h4>
        <div className="hud-row">
          <span>Queue</span>
          <b>{me ? `#${me.position}` : queue.length === 0 ? "—" : "not joined"}</b>
        </div>
        <div className="hud-row">
          <span>Wait</span>
          <b>{me ? formatWait(me.estWaitSec) : "—"}</b>
        </div>
        <div className="hud-row">
          <span><i className={`dot ${dot}`} /> Agent</span>
          <b>{agent ? (agent.status === "WORKING" ? "WORKING…" : agent.status) : "…"}</b>
        </div>
        <div className="progress slim">
          <div style={{ width: `${agent?.progress ?? 0}%` }} />
        </div>
        <div className="online-line"><i className="dot green" /> {online} online</div>
      </div>
      <div className="hud-tr">
        <div style={{ display: "flex", gap: 6 }}>
          <button className="pill-btn" onClick={onToggleMusic}>
            🎵 Music {musicOn ? "ON" : "OFF"}
          </button>
          <button className="pill-btn" onClick={onToggleSfx}>
            🔊 SFX {sfxOn ? "ON" : "OFF"}
          </button>
        </div>
        <QueuePanel queue={queue} myId={myId} />
        <AgentPanel agent={agent} playerName={playerName} />
      </div>
    </>
  );
}

export function QueuePanel({ queue, myId }: { queue: QueueItem[]; myId: string }) {
  return (
    <div className="queue-panel">
      <h4>💈 SALON QUEUE <span className="count">{queue.length}</span></h4>
      {queue.length === 0 && <div className="dim">Khaali hai boss, turant number aayega!</div>}
      <ol>
        {queue.map((q) => (
          <li key={q.id} className={q.id === myId ? "you" : ""}>
            <span className="pos">#{q.position}</span>
            <span className="qn">{q.name} {q.id === myId ? "← You" : ""}</span>
            <span className="qw">{formatWait(q.estWaitSec)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

const PROVIDERS = ["Antigravity", "ChatGPT", "Claude Code", "Cursor", "Copilot", "Gemini", "Terminal"];

export function AgentPanel({ agent, playerName }: { agent: AgentInfo | null; playerName: string }) {
  const [showConnect, setShowConnect] = useState(false);
  const [prov, setProv] = useState("Antigravity");
  const [copied, setCopied] = useState(false);
  if (!agent) return <div className="agent-panel">🤖 Connecting agent…</div>;
  const dot = agent.status === "WORKING" ? "green" : agent.status === "COMPLETED" ? "gold" : agent.status === "FAILED" ? "red" : "gray";
  const cmd = `npm run agent -- --name "${playerName || "You"}" --provider ${prov} -- <your-command>`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(cmd);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };
  return (
    <div className="agent-panel">
      <h4><i className={`dot ${dot}`} /> YOUR AI AGENT</h4>
      <div className="prov">{providerIcon(agent.provider)} {agent.provider}</div>
      <div className="task">{agent.task}</div>
      <div className="dim">Status: {agent.status === "WORKING" ? "WORKING…" : agent.status}</div>
      <div className="progress striped">
        <div style={{ width: `${agent.progress}%` }} />
      </div>
      <div className="dim">
        {Math.floor(agent.progress)}% • ETA {formatWait(agent.etaSec)}
      </div>
      {agent.status === "COMPLETED" && <div className="done">🎉 AGENT COMPLETE — deploy ho gaya!</div>}
      <button className="pill-btn" style={{ marginTop: 6 }} onClick={() => setShowConnect((v) => !v)}>
        🔌 {agent.provider === "Salon Sim" ? "Connect real agent" : "Change agent"}
      </button>
      {showConnect && (
        <div style={{ marginTop: 6 }}>
          <div className="dim">Which AI works for you?</div>
          <div style={{ display: "flex", gap: 6, margin: "4px 0", flexWrap: "wrap" }}>
            {PROVIDERS.map((p) => (
              <button key={p} className={`pill-btn ${prov === p ? "active" : ""}`} onClick={() => setProv(p)}>
                {p}
              </button>
            ))}
          </div>
          <div className="dim">In server/ run:</div>
          <code className="uri">{cmd}</code>
          <button className="pill-btn" style={{ marginTop: 4 }} onClick={copy}>
            {copied ? "Copied! ✓" : "Copy command"}
          </button>
        </div>
      )}
    </div>
  );
}

export function ChatBox({
  log,
  onSend,
  onEmote,
}: {
  log: ChatMsg[];
  onSend: (t: string) => void;
  onEmote: (e: string) => void;
}) {
  const [text, setText] = useState("");
  const logRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    logRef.current?.scrollTo({ top: 1e6 });
  }, [log]);
  return (
    <div className="chat-box">
      <div className="chat-log" ref={logRef}>
        {log.slice(-30).map((m, i) => (
          <div key={i} className={m.system ? "sys" : ""}>
            <b>{m.from}:</b> {m.text}
          </div>
        ))}
      </div>
      <div className="chat-row">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && text.trim()) {
              onSend(text.trim());
              setText("");
            }
          }}
          placeholder="Chat… (Enter)"
          maxLength={200}
        />
      </div>
      <div className="emote-bar">
        {EMOTES.map((e) => (
          <button key={e.id} className="pill-btn" title={e.label} onClick={() => onEmote(e.id)}>
            {e.emoji}
          </button>
        ))}
      </div>
    </div>
  );
}

export function HaircutMenu({
  onPick,
  onClose,
}: {
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="haircut-menu">
      <h3>What are we doing today, boss? 💈</h3>
      <div style={{ opacity: 0.75, fontSize: 13 }}>Bhaiya ko bharosa hai. Tum bas choose karo.</div>
      <div className="haircut-grid">
        {HAIRCUTS.map((h) => (
          <button key={h.id} className="haircut-card" onClick={() => onPick(h.id)}>
            <div style={{ fontSize: 20 }}>
              {h.emoji} <b>{h.name}</b>
            </div>
            <div style={{ fontSize: 12, opacity: 0.8 }}>{h.hindi}</div>
            <div style={{ fontSize: 12 }}>
              {h.displayTime} • {h.price}
            </div>
          </button>
        ))}
      </div>
      <button className="pill-btn" style={{ marginTop: 10 }} onClick={onClose}>
        Baad mein
      </button>
    </div>
  );
}

export function TurnToast({ chairId, chairs }: { chairId: number; chairs: ChairInfo[] }) {
  void chairs;
  return (
    <div className="turn-toast">
      <div>🔔 YOUR TURN!</div>
      <div className="toast-sub">Chair #{chairId + 1} is ready — walk over & press E</div>
    </div>
  );
}
