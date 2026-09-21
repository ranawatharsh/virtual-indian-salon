import { useEffect, useRef, useState } from "react";
import { salonAudio } from "../audio/salonAudio";
import { jukebox } from "../music/jukebox";
import { spotifyMusic } from "../music/spotify";

type Tab = "radio" | "files" | "spotify";

export function Jukebox({ musicOn, onToggleMusic }: { musicOn: boolean; onToggleMusic: () => void }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("radio");
  const [, force] = useState(0);
  const [cid, setCid] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const u1 = jukebox.subscribe(() => force((x) => x + 1));
    const u2 = spotifyMusic.subscribe(() => force((x) => x + 1));
    setCid(spotifyMusic.clientId);
    return () => {
      u1();
      u2();
    };
  }, []);

  const switchTab = (t: Tab) => {
    setTab(t);
    if (t === "radio") {
      jukebox.stop();
      salonAudio.setMusicOn(musicOn);
    } else {
      // external music takes over the salon speakers
      salonAudio.setMusicOn(false);
    }
  };

  const sp = spotifyMusic.getStatus();
  const cur = jukebox.current();

  if (!open) {
    return (
      <button className="jukebox-fab" onClick={() => setOpen(true)} title="Salon jukebox">
        🎧 Jukebox
      </button>
    );
  }

  return (
    <div className="jukebox-panel">
      <div className="jukebox-head">
        <b>🎧 Salon Jukebox</b>
        <button className="pill-btn" onClick={() => setOpen(false)}>✕</button>
      </div>
      <div className="jukebox-tabs">
        {(["radio", "files", "spotify"] as Tab[]).map((t) => (
          <button key={t} className={`pill-btn ${tab === t ? "active" : ""}`} onClick={() => switchTab(t)}>
            {t === "radio" ? "📻 Radio" : t === "files" ? "📁 My Files" : "🟢 Spotify"}
          </button>
        ))}
      </div>

      {tab === "radio" && (
        <div className="jukebox-body">
          <div><b>Retro Salon Radio</b></div>
          <div className="dim">Ghar ka royalty-free house band. Koi copyright tension nahi.</div>
          <button className="pill-btn" onClick={onToggleMusic}>🎵 Radio {musicOn ? "ON" : "OFF"}</button>
        </div>
      )}

      {tab === "files" && (
        <div className="jukebox-body">
          <div><b>Your own collection</b></div>
          <div className="dim">Downloaded Bollywood classics? Pick them here — they play ONLY in your browser, never uploaded.</div>
          <input
            ref={fileRef}
            type="file"
            accept="audio/*,.mp3,.wav,.ogg,.m4a,.flac"
            multiple
            style={{ display: "none" }}
            onChange={(e) => {
              if (e.target.files?.length) jukebox.addFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <div style={{ display: "flex", gap: 6, margin: "6px 0" }}>
            <button className="pill-btn" onClick={() => fileRef.current?.click()}>📁 Choose songs</button>
            {jukebox.tracks.length > 0 && <button className="pill-btn" onClick={() => jukebox.clear()}>Clear</button>}
          </div>
          {cur && <div className="now-playing">▶ {cur.name}</div>}
          {jukebox.tracks.length > 0 && (
            <>
              <div style={{ display: "flex", gap: 6, margin: "6px 0" }}>
                <button className="pill-btn" onClick={() => jukebox.prev()}>⏮</button>
                <button className="pill-btn" onClick={() => jukebox.toggle()}>{jukebox.playing ? "⏸" : "▶"}</button>
                <button className="pill-btn" onClick={() => jukebox.next()}>⏭</button>
                <button className={`pill-btn ${jukebox.shuffle ? "active" : ""}`} onClick={() => jukebox.toggleShuffle()}>🔀</button>
              </div>
              <div className="track-list">
                {jukebox.tracks.map((t, i) => (
                  <button key={i} className={`track ${i === jukebox.index ? "sel" : ""}`} onClick={() => jukebox.playAt(i)}>
                    {i === jukebox.index && jukebox.playing ? "▶ " : ""}{t.name}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {tab === "spotify" && (
        <div className="jukebox-body">
          <div><b>Spotify Connect</b></div>
          <div className="dim">Salon tab becomes a speaker. Needs Spotify <b>Premium</b>.</div>
          {sp.error && <div className="sp-err">{sp.error}</div>}
          {!sp.authed ? (
            <>
              <div className="dim">Redirect URI (paste in Spotify dashboard → Redirect URIs):</div>
              <code className="uri">{spotifyMusic.redirectUri()}</code>
              <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                <input
                  value={cid}
                  onChange={(e) => setCid(e.target.value)}
                  placeholder="Spotify Client ID"
                  className="sp-input"
                />
                <button className="pill-btn" onClick={() => spotifyMusic.setClientId(cid)}>Save</button>
              </div>
              <button className="pill-btn" style={{ marginTop: 6 }} disabled={!spotifyMusic.clientId} onClick={() => void spotifyMusic.login()}>
                🟢 Connect Spotify
              </button>
              <details className="dim" style={{ marginTop: 6 }}>
                <summary>Setup (2 min, free)</summary>
                1. Open developer.spotify.com/dashboard → Create app
                <br />2. Add the Redirect URI above → Save
                <br />3. Copy the Client ID → paste here → Connect
              </details>
            </>
          ) : (
            <>
              <div className="now-playing">{sp.track ? `▶ ${sp.track} — ${sp.artists ?? ""}` : sp.connected ? "Connected. Play something from your Spotify app!" : "Login OK."}</div>
              <div style={{ display: "flex", gap: 6, margin: "6px 0", flexWrap: "wrap" }}>
                {!sp.connected && <button className="pill-btn" onClick={() => void spotifyMusic.initPlayer()}>🔊 Start player</button>}
                {sp.connected && (
                  <>
                    <button className="pill-btn" onClick={() => void spotifyMusic.togglePlay()}>{sp.playing ? "⏸" : "▶"}</button>
                    <button className="pill-btn" onClick={() => void spotifyMusic.prev()}>⏮</button>
                    <button className="pill-btn" onClick={() => void spotifyMusic.next()}>⏭</button>
                  </>
                )}
                <button className="pill-btn" onClick={() => spotifyMusic.logout()}>Disconnect</button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
