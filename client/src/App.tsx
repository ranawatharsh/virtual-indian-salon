import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LandingPage, AvatarSelect, useOnlineCount } from "./components/screens";
import { Hud, ChatBox, HaircutMenu, TurnToast } from "./components/hud";
import { Jukebox } from "./components/Jukebox";
import { SalonScene, CHAIR_POS, DESK_POS, SOFA_POS, SALON_DOOR, CLUB_DOOR, PRELOAD_MODELS, isClubX, type InteractTarget } from "./game/SalonScene";
import { useGLTF } from "@react-three/drei";
import { spotifyMusic } from "./music/spotify";
import {
  getSocket,
  type AgentInfo,
  type ChairInfo,
  type ChatMsg,
  type QueueItem,
  type RemotePlayer,
} from "./multiplayer/socket";
import { salonAudio } from "./audio/salonAudio";
import { HAIRCUTS } from "./data";

type Screen = "landing" | "select" | "salon";

export default function App() {
  const [screen, setScreen] = useState<Screen>("landing");
  const [name, setName] = useState(() => localStorage.getItem("salon:name") ?? "");
  const [avatarId, setAvatarId] = useState(() => localStorage.getItem("salon:avatar") ?? "glasses");
  const online = useOnlineCount();

  const [myId, setMyId] = useState("");
  const [remotes, setRemotes] = useState<Record<string, RemotePlayer>>({});
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [chairs, setChairs] = useState<ChairInfo[]>([]);
  const [chat, setChat] = useState<ChatMsg[]>([
    { from: "Bhaiya", text: "Welcome to Style Saloon! Chair khaali hai, tension nahi! 💈", ts: Date.now(), system: true },
  ]);
  const [agent, setAgent] = useState<AgentInfo | null>(null);
  const [remoteAgents, setRemoteAgents] = useState<Record<string, AgentInfo>>({});
  const [onlineCount, setOnlineCount] = useState(1);
  const [myTurnChair, setMyTurnChair] = useState<number | null>(null);
  const [seatedChair, setSeatedChair] = useState<number | null>(null);
  const [sofaSeated, setSofaSeated] = useState(false);
  const [showHaircutMenu, setShowHaircutMenu] = useState(false);
  const [dialogues, setDialogues] = useState<Record<number, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const [connected, setConnected] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const [musicOn, setMusicOn] = useState(true);
  const [sfxOn, setSfxOn] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  const myPos = useRef({ x: 0, z: 7 });
  const myRot = useRef(Math.PI);
  const myIdRef = useRef("");
  useEffect(() => {
    myIdRef.current = myId;
  }, [myId]);

  // Spotify OAuth callback (handles ?code= after redirect) + session restore
  useEffect(() => {
    spotifyMusic.restore();
    void spotifyMusic.handleCallback();
  }, []);

  // Warm the free 3D-model cache as soon as the salon opens
  useEffect(() => {
    if (screen === "salon") {
      for (const u of PRELOAD_MODELS) useGLTF.preload(u);
    }
  }, [screen]);
  const interactRef = useRef<InteractTarget>({ kind: null });
  const stateRef = useRef({ myTurnChair, seatedChair, sofaSeated, queue, myId, showHaircutMenu });
  stateRef.current = { myTurnChair, seatedChair, sofaSeated, queue, myId, showHaircutMenu };

  const pushChat = useCallback((m: ChatMsg) => {
    setChat((c) => [...c.slice(-60), m]);
  }, []);

  const sayToast = useCallback((t: string) => {
    setToast(t);
    setTimeout(() => setToast((cur) => (cur === t ? null : cur)), 4000);
  }, []);

  // ---------- socket lifecycle ----------
  useEffect(() => {
    if (screen !== "salon") return;
    const socket = getSocket();

    const onConnect = () => {
      setConnected(true);
      setErr(null);
      socket.emit("join", { name: name.trim() || "Guest", avatarId });
    };
    const onDisconnect = () => {
      setConnected(false);
      setErr("Looks like the barber's Wi-Fi died. Reconnecting… 📶");
    };
    const onInit = (d: any) => {
      setMyId(d.playerId);
      myPos.current = { x: d.players.find((p: any) => p.id === d.playerId)?.x ?? 0, z: 7 };
      const others: Record<string, RemotePlayer> = {};
      for (const p of d.players as RemotePlayer[]) if (p.id !== d.playerId) others[p.id] = p;
      setRemotes(others);
      setChairs(d.chairs);
      if (d.agent) setAgent(d.agent);
      salonAudio.start();
    };
    const onJoined = (d: any) => setRemotes((r) => ({ ...r, [d.player.id]: d.player }));
    const onMoved = (d: any) =>
      setRemotes((r) => (r[d.playerId] ? { ...r, [d.playerId]: { ...r[d.playerId], ...d } } : r));
    const onLeft = (d: any) => {
      setRemotes((r) => {
        const n = { ...r };
        delete n[d.playerId];
        return n;
      });
      setRemoteAgents((r) => {
        const n = { ...r };
        delete n[d.playerId];
        return n;
      });
    };
    const onQueue = (d: any) => setQueue(d.queue);
    const onChairs = (d: any) => setChairs(d.chairs);
    const onChat = (m: ChatMsg) => pushChat(m);
    const onYourTurn = (d: any) => {
      setMyTurnChair(d.chairId);
      setShowHaircutMenu(false);
      salonAudio.bell();
      if (isClubX(myPos.current.x)) {
        // beamed straight back from the dance floor to your chair
        const c = CHAIR_POS[d.chairId];
        myPos.current = { x: c.x, z: c.z + 2.6 };
        myRot.current = Math.PI;
        handleMove(myPos.current.x, myPos.current.z, myRot.current, false);
        sayToast(`🔔 YOUR TURN! Club se wapas — Chair #${d.chairId + 1}, press E!`);
      } else {
        sayToast(`🔔 YOUR TURN! Chair #${d.chairId + 1} is ready — walk there & press E!`);
      }
    };
    const onStatus = (d: any) =>
      setRemotes((r) => (r[d.playerId] ? { ...r, [d.playerId]: { ...r[d.playerId], activity: d.activity, chairId: d.chairId ?? r[d.playerId].chairId, haircut: d.haircut ?? r[d.playerId].haircut } } : r));
    const onEmote = (d: any) =>
      setRemotes((r) => (r[d.playerId] ? { ...r, [d.playerId]: { ...r[d.playerId], emote: d.emote } } : r));
    const onDialogue = (d: any) => {
      setDialogues((prev) => ({ ...prev, [d.chairId]: d.text }));
      if (d.text.toLowerCase().includes("ho gaya") || d.text.toLowerCase().includes("mirror")) salonAudio.bell();
      else if (Math.random() < 0.5) salonAudio.snip();
      setTimeout(() => setDialogues((prev) => {
        const n = { ...prev };
        if (n[d.chairId] === d.text) delete n[d.chairId];
        return n;
      }), 4500);
    };
    const onDone = () => {
      sayToast("💈 Ho gaya boss! Mirror mein dekh lo. (E to get up)");
      setShowHaircutMenu(false);
      salonAudio.bell();
    };
    const onFinishing = () => salonAudio.clipper(1500);
    const onAgent = (d: any) => setAgent(d.agent);
    const onAgentBroadcast = (d: any) => {
      if (!d?.playerId || !d?.agent) return;
      if (d.playerId === myIdRef.current) {
        setAgent(d.agent);
        return;
      }
      setRemoteAgents((r) => ({ ...r, [d.playerId]: d.agent }));
    };
    const onOnline = (d: any) => setOnlineCount(d.count);
    const onRoomFull = () => setErr("Salon full hai boss! Thoda wait karo, phir try karo. 💈");
    const onErrMsg = (d: any) => sayToast(d.message);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onDisconnect);
    socket.on("init", onInit);
    socket.on("playerJoined", onJoined);
    socket.on("playerMoved", onMoved);
    socket.on("playerLeft", onLeft);
    socket.on("queueUpdate", onQueue);
    socket.on("chairUpdate", onChairs);
    socket.on("chatMessage", onChat);
    socket.on("yourTurn", onYourTurn);
    socket.on("playerStatus", onStatus);
    socket.on("playerEmote", onEmote);
    socket.on("barberDialogue", onDialogue);
    socket.on("haircutDone", onDone);
    socket.on("haircutFinishing", onFinishing);
    socket.on("agentUpdate", onAgent);
    socket.on("agentBroadcast", onAgentBroadcast);
    socket.on("onlineCount", onOnline);
    socket.on("roomFull", onRoomFull);
    socket.on("errorMessage", onErrMsg);

    if (socket.connected) onConnect();
    else socket.connect();

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onDisconnect);
      socket.off("init", onInit);
      socket.off("playerJoined", onJoined);
      socket.off("playerMoved", onMoved);
      socket.off("playerLeft", onLeft);
      socket.off("queueUpdate", onQueue);
      socket.off("chairUpdate", onChairs);
      socket.off("chatMessage", onChat);
      socket.off("yourTurn", onYourTurn);
      socket.off("playerStatus", onStatus);
      socket.off("playerEmote", onEmote);
      socket.off("barberDialogue", onDialogue);
      socket.off("haircutDone", onDone);
      socket.off("haircutFinishing", onFinishing);
      socket.off("agentUpdate", onAgent);
      socket.off("agentBroadcast", onAgentBroadcast);
      socket.off("onlineCount", onOnline);
      socket.off("roomFull", onRoomFull);
      socket.off("errorMessage", onErrMsg);
    };
  }, [screen, name, avatarId, pushChat, sayToast]);

  // detect my chair from chairs snapshot (covers reconnect edge)
  useEffect(() => {
    if (!myId) return;
    const mine = chairs.find((c) => c.occupantId === myId);
    if (mine) {
      setSeatedChair(mine.id);
      setMyTurnChair((t) => (t === mine.id ? t : t));
      if (mine.state === "OCCUPIED") setShowHaircutMenu((s) => s);
    } else {
      setSeatedChair((s) => (s !== null && !chairs[s] ? s : chairs.some((c) => c.occupantId === myId) ? s : null));
    }
  }, [chairs, myId]);

  // client-side agent progress animation (server is authoritative-ish; we ping occasionally)
  useEffect(() => {
    if (screen !== "salon" || !agent) return;
    if (agent.status !== "WORKING") return;
    const t = setInterval(() => {
      setAgent((a) => {
        if (!a || a.status !== "WORKING") return a;
        const np = Math.min(100, a.progress + 1.2);
        const done = np >= 100;
        if (done) {
          pushChat({ from: "AI Agent 🤖", text: "Task complete boss! Deploy ho gaya. 🎉", ts: Date.now(), system: true });
          sayToast("🎉 AGENT COMPLETE — Your AI finished the task.");
        }
        return { ...a, progress: np, etaSec: Math.max(0, a.etaSec - 2), status: done ? "COMPLETED" : a.status };
      });
    }, 2000);
    return () => clearInterval(t);
  }, [screen, agent?.status, pushChat, sayToast]);

  const inQueue = useMemo(() => queue.some((q) => q.id === myId), [queue, myId]);
  const myChairState = seatedChair !== null ? chairs[seatedChair] : null;
  const cutting = myChairState?.state === "CUTTING";
  const cutProgress = useMemo(() => {
    if (!myChairState?.startedAt || !myChairState?.endsAt) return null;
    const total = myChairState.endsAt - myChairState.startedAt;
    const left = Math.max(0, myChairState.endsAt - Date.now());
    return { pct: Math.min(100, ((total - left) / total) * 100), leftSec: Math.ceil(left / 1000) };
  }, [myChairState, chat]);

  // ---------- actions ----------
  const handleMove = useCallback(
    (x: number, z: number, rotY: number, walking: boolean) => {
      const s = getSocket();
      if (!s.connected) return;
      const st = stateRef.current;
      s.emit("move", {
        x: Math.round(x * 50) / 50,
        z: Math.round(z * 50) / 50,
        rotY: Math.round(rotY * 50) / 50,
        activity: st.seatedChair !== null ? "GETTING_HAIRCUT" : st.sofaSeated ? "SITTING" : st.queue.some((q) => q.id === st.myId) ? (walking ? "WALKING" : "WAITING") : walking ? "WALKING" : "IDLE",
      });
    },
    []
  );

  const nearestInteract = useCallback((): InteractTarget => {
    const st = stateRef.current;
    const { x, z } = myPos.current;
    if (st.seatedChair !== null) {
      const c = chairs[st.seatedChair];
      if (c?.state === "OCCUPIED") return { kind: "chair", chairId: st.seatedChair, label: "Choose haircut (E)" };
      return { kind: "chair", chairId: st.seatedChair, label: cutting ? "Cutting… (E to stand)" : "Stand up (E)" };
    }
    if (st.sofaSeated) return { kind: "sofa", label: "Get up (E)" };
    const clubbed = isClubX(myPos.current.x);
    if (!clubbed && Math.hypot(x - SALON_DOOR.x, z - SALON_DOOR.z) < 2.6)
      return { kind: "portal", to: "club", label: "Enter Club Bollywood 🪩 (E)" };
    if (clubbed && Math.hypot(x - CLUB_DOOR.x, z - CLUB_DOOR.z) < 2.6)
      return { kind: "portal", to: "salon", label: "Back to Salon 💈 (E)" };
    if (st.myTurnChair !== null) {
      const c = CHAIR_POS[st.myTurnChair];
      const d = Math.hypot(x - c.x, z - c.z);
      if (d < 2.4) return { kind: "chair", chairId: st.myTurnChair, label: "Sit in chair (E)" };
    }
    const dd = Math.hypot(x - DESK_POS.x, z - DESK_POS.z);
    if (dd < 2.8) return { kind: "reception", label: inQueue ? "Leave queue (E)" : "Join queue (E)" };
    // sofa proximity (faces the barbers now)
    if (!clubbed && Math.hypot(x - SOFA_POS.x, z - (SOFA_POS.z - 0.6)) < 2.4)
      return { kind: "sofa", label: "Sit & chill (E)" };
    // any free chair proximity hint (must be in queue first)
    return { kind: null };
  }, [chairs, cutting, inQueue]);

  const [hint, setHint] = useState<string | null>(null);
  const clubRef = useRef(false);
  useEffect(() => {
    if (screen !== "salon") return;
    const t = setInterval(() => {
      const it = nearestInteract();
      interactRef.current = it;
      setHint(it.label ?? null);
      // club enter/exit: flip the radio into party mode
      const nowClub = isClubX(myPos.current.x);
      if (nowClub !== clubRef.current) {
        clubRef.current = nowClub;
        salonAudio.setParty(nowClub);
        if (nowClub) sayToast("🪩 CLUB BOLLYWOOD — everybody dance! Turn aayega toh wapas bhej denge.");
      }
    }, 200);
    return () => clearInterval(t);
  }, [screen, nearestInteract, sayToast]);

  const doInteract = useCallback(() => {
    const it = interactRef.current;
    const st = stateRef.current;
    const s = getSocket();
    if (!it.kind) return;
    if (it.kind === "reception") {
      if (st.queue.some((q) => q.id === st.myId)) s.emit("leaveQueue");
      else {
        s.emit("joinQueue");
        salonAudio.bell();
      }
    } else if (it.kind === "chair" && it.chairId !== undefined) {
      if (st.seatedChair !== null) {
        // seated: E opens menu if OCCUPIED else stand
        const c = chairs[st.seatedChair];
        if (c?.state === "OCCUPIED") setShowHaircutMenu((v) => !v);
        else {
          s.emit("leaveChair");
          setSeatedChair(null);
          setMyTurnChair(null);
          setShowHaircutMenu(false);
          myPos.current.z = Math.min(8, myPos.current.z + 1.6);
        }
      } else {
        // walk-in sit is server-driven; but client snaps immediately for feel
        setSeatedChair(it.chairId);
        setSofaSeated(false);
        const c = CHAIR_POS[it.chairId];
        myPos.current.x = c.x;
        myPos.current.z = c.z;
        const mine = chairs[it.chairId];
        if (mine?.state === "OCCUPIED" && mine.occupantId === st.myId) setShowHaircutMenu(true);
      }
    } else if (it.kind === "sofa") {
      setSofaSeated((v) => !v);
    } else if (it.kind === "portal") {
      if (it.to === "club") {
        myPos.current = { x: 31, z: 6 };
        myRot.current = Math.PI / 2;
        sayToast("Welcome to CLUB BOLLYWOOD! 🪩💃");
      } else {
        myPos.current = { x: 10.4, z: 6 };
        myRot.current = -Math.PI / 2;
        sayToast("Back in the salon. Bhaiya misses you! 💈");
      }
      salonAudio.bell();
      handleMove(myPos.current.x, myPos.current.z, myRot.current, false);
    }
  }, [chairs, handleMove, sayToast]);

  // global keys: E interact, ESC menu
  useEffect(() => {
    if (screen !== "salon") return;
    const h = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key.toLowerCase() === "e") doInteract();
      if (e.key === "Escape") setShowMenu((v) => !v);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [screen, doInteract]);

  // keep seatedChair in sync when server frees chair (haircutDone)
  useEffect(() => {
    const s = getSocket();
    const h = () => {
      setSeatedChair(null);
      setMyTurnChair(null);
    };
    s.on("haircutDone", h);
    return () => void s.off("haircutDone", h);
  }, []);

  if (screen === "landing") return <LandingPage onEnter={() => setScreen("select")} online={online} />;
  if (screen === "select")
    return (
      <AvatarSelect
        name={name}
        setName={setName}
        avatarId={avatarId}
        setAvatarId={setAvatarId}
        onJoin={() => {
          localStorage.setItem("salon:name", name.trim());
          localStorage.setItem("salon:avatar", avatarId);
          setScreen("salon");
        }}
      />
    );

  const myHaircut = myChairState?.haircutType ? HAIRCUTS.find((h) => h.id === myChairState.haircutType) : null;

  const toggleMusic = () => {
    const v = !musicOn;
    setMusicOn(v);
    salonAudio.setMusicOn(v);
  };
  const toggleSfx = () => {
    const v = !sfxOn;
    setSfxOn(v);
    salonAudio.setSfxOn(v);
  };

  return (
    <div className="game-wrap">
      <SalonScene
        myId={myId}
        myAvatar={avatarId}
        myName={name || "Guest"}
        remotes={remotes}
        agents={remoteAgents}
        chairs={chairs}
        dialogues={dialogues}
        myPos={myPos}
        myRot={myRot}
        seatedChair={seatedChair}
        sofaSeated={sofaSeated}
        onMove={handleMove}
        interactRef={interactRef}
      />
      <Hud
        queue={queue}
        myId={myId}
        agent={agent}
        online={onlineCount}
        musicOn={musicOn}
        sfxOn={sfxOn}
        playerName={name || "Guest"}
        onToggleMusic={toggleMusic}
        onToggleSfx={toggleSfx}
      />
      <Jukebox musicOn={musicOn} onToggleMusic={toggleMusic} />
      {!connected || err ? <div className="err-banner">{err ?? "Reconnecting…"}</div> : null}
      {myTurnChair !== null && seatedChair === null && (
        <TurnToast chairId={myTurnChair} chairs={chairs} />
      )}
      {toast && <div className="interact-hint" style={{ bottom: 160 }}>{toast}</div>}
      {hint && !showHaircutMenu && <div className="interact-hint">{hint} — press E</div>}
      {cutting && cutProgress && (
        <div className="interact-hint" style={{ bottom: 200 }}>
          💈 {myHaircut?.name ?? "Cutting"}… {cutProgress.pct.toFixed(0)}% ({cutProgress.leftSec}s) — Bhaiya kaam kar raha hai!
        </div>
      )}
      {showHaircutMenu && seatedChair !== null && (
        <HaircutMenu
          onPick={(id) => {
            getSocket().emit("selectHaircut", { chairId: seatedChair, type: id });
            setShowHaircutMenu(false);
            salonAudio.clipper(1500);
            sayToast("Bhaiya shuru! 💈");
          }}
          onClose={() => setShowHaircutMenu(false)}
        />
      )}
      <ChatBox
        log={chat}
        onSend={(t) => getSocket().emit("chat", { text: t })}
        onEmote={(e) => getSocket().emit("emote", { emote: e })}
      />
      <div className="bottom-bar">WASD Move &nbsp;|&nbsp; Shift Run &nbsp;|&nbsp; Drag Mouse to Look &nbsp;|&nbsp; E Interact &nbsp;|&nbsp; Enter Chat &nbsp;|&nbsp; ESC Menu</div>
      {showMenu && (
        <div className="menu-overlay" onClick={() => setShowMenu(false)}>
          <div className="menu-card" onClick={(e) => e.stopPropagation()}>
            <h3>💈 Salon Menu</h3>
            <p style={{ opacity: 0.75 }}>{name} • {onlineCount} online</p>
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <button className="pill-btn" onClick={() => setShowMenu(false)}>Back (ESC)</button>
              <button
                className="pill-btn"
                onClick={() => {
                  getSocket().disconnect();
                  setScreen("landing");
                  setShowMenu(false);
                  setSeatedChair(null);
                  setMyTurnChair(null);
                }}
              >
                Leave Salon
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
