import { useEffect, useState } from "react";

export function LandingPage({ onEnter, online }: { onEnter: () => void; online: number | null }) {
  return (
    <div className="landing">
      <div className="marquee"><span>💈 HAIRCUT ✂️ CHAMPI 💆 SHAVE 🪒 CHAI ☕ GUP-SHUP 🗣️ 💈 HAIRCUT ✂️ CHAMPI 💆 SHAVE 🪒 CHAI ☕ GUP-SHUP 🗣️&nbsp;</span></div>
      <div className="tag">Your AI is busy. You don&apos;t have to be.</div>
      <h1>
        WHILE AI WORKS.
        <br />
        <span className="gold">GET A HAIRCUT. 💈</span>
      </h1>
      <p className="sub">Your agent is grinding. You deserve a break.</p>
      <div className="est">★ EST. 1998 • BANDRA WEST ★</div>
      <div className="feat-chips">
        <span>🚶 Walk around</span>
        <span>💈 Join the queue</span>
        <span>💬 Chat with devs</span>
        <span>🤖 Watch your agent</span>
        <span>🎧 Salon jukebox</span>
      </div>
      <div className="online-pill">
        <i className="dot green pulse" /> {online === null ? "Connecting to salon…" : `${online} DEVELOPERS ONLINE`}
      </div>
      <div style={{ height: 18 }} />
      <button className="big-btn" onClick={onEnter}>
        ENTER SALON 💈
      </button>
      <div className="foot">
        A virtual Indian salon for people who spend too much time talking to AI.
        <br />
        Your AI works. You chill.
      </div>
    </div>
  );
}

const FACE: Record<string, string> = {
  glasses: "🤓",
  casual: "🧑🏽",
  bearded: "🧔🏽",
  cool: "😎",
  nerd: "🤓",
  bald: "👨🏽‍🦲",
  female: "👩🏽‍💻",
  generic: "🧑🏽‍💻",
  robot: "🤖",
};

import { AVATARS } from "../data";

const TINT_DOT: Record<string, string> = {
  glasses: "#2d6a4f",
  casual: "#e76f51",
  bearded: "#343a40",
  cool: "#9d4edd",
  nerd: "#4cc9f0",
  bald: "#ffb703",
  female: "#ff5d8f",
  generic: "#6c757d",
  robot: "#00b4d8",
};

export function AvatarSelect({
  name,
  setName,
  avatarId,
  setAvatarId,
  onJoin,
}: {
  name: string;
  setName: (s: string) => void;
  avatarId: string;
  setAvatarId: (s: string) => void;
  onJoin: () => void;
}) {
  return (
    <div className="select-screen">
      <h2>Choose your avatar 💈</h2>
      <div style={{ opacity: 0.75, fontSize: 14 }}>Ye look sabko dikhega, boss.</div>
      <div className="avatar-grid">
        {AVATARS.map((a) => (
          <button
            key={a.id}
            className={`avatar-card ${avatarId === a.id ? "sel" : ""}`}
            onClick={() => setAvatarId(a.id)}
          >
            <div className="avatar-face">{FACE[a.id] ?? "🧑🏽"}</div>
            <span className="tint-dot" style={{ background: TINT_DOT[a.id] ?? "#999" }} />
            <small>{a.label}</small>
          </button>
        ))}
      </div>
      <div className="name-row">
        <input
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, 16))}
          placeholder="Name: Harsh"
          maxLength={16}
          onKeyDown={(e) => {
            if (e.key === "Enter" && name.trim()) onJoin();
          }}
        />
        <button
          className="pill-btn"
          title="Surprise me"
          onClick={() => {
            const pick = AVATARS[Math.floor(Math.random() * AVATARS.length)];
            setAvatarId(pick.id);
          }}
        >
          🎲
        </button>
      </div>
      <button className="big-btn" onClick={onJoin} disabled={!name.trim()}>
        Enter Salon
      </button>
    </div>
  );
}

export function useOnlineCount(): number | null {
  const [n, setN] = useState<number | null>(null);
  useEffect(() => {
    let stop = false;
    const fetchIt = async () => {
      try {
        const { serverHttpBase } = await import("../multiplayer/socket");
        const r = await fetch(`${serverHttpBase()}/api/online`);
        const j = await r.json();
        if (!stop) setN(j.count ?? 0);
      } catch {
        /* salon server offline — landing still works */
      }
    };
    fetchIt();
    const t = setInterval(fetchIt, 5000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, []);
  return n;
}
