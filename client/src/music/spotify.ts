// Spotify for the salon jukebox.
//
// Auth: Authorization Code + PKCE (no client secret in the browser).
// Playback: Spotify Web Playback SDK — the salon tab becomes a Spotify
// Connect speaker; the user picks songs from any Spotify app and the audio
// comes out of the salon tab.
//
// Requirements the user must know about:
//  1. A FREE Spotify developer app (just a Client ID, 2 min setup).
//  2. Spotify PREMIUM (hard requirement of the Web Playback SDK).
// Tokens are kept in localStorage; nothing goes through our game server.

const SCOPES = [
  "streaming",
  "user-read-email",
  "user-read-private",
  "user-read-playback-state",
  "user-modify-playback-state",
].join(" ");

const AUTH_LS = "salon:spotify:auth";
const CID_LS = "salon:spotify:clientId";
const VERIFIER_SS = "salon:spotify:verifier";

export interface SpotifyStatus {
  authed: boolean;
  connected: boolean;
  playing: boolean;
  track: string | null;
  artists: string | null;
  error: string | null;
}

declare global {
  interface Window {
    Spotify?: any;
    onSpotifyWebPlaybackSDKReady?: () => void;
  }
}

function randomString(len: number): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  const buf = new Uint32Array(len);
  crypto.getRandomValues(buf);
  return [...buf].map((n) => chars[n % chars.length]).join("");
}

function b64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return b64url(digest);
}

type Listener = () => void;

class SpotifyMusic {
  private status: SpotifyStatus = {
    authed: false,
    connected: false,
    playing: false,
    track: null,
    artists: null,
    error: null,
  };
  private listeners = new Set<Listener>();
  private player: any = null;
  private deviceId = "";
  private token = "";
  private refreshToken = "";
  private expAt = 0;
  private sdkPromise: Promise<void> | null = null;

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private emit() {
    this.listeners.forEach((f) => f());
  }

  getStatus(): SpotifyStatus {
    return this.status;
  }

  private setError(e: string | null) {
    this.status.error = e;
    this.emit();
  }

  get clientId(): string {
    try {
      return (
        localStorage.getItem(CID_LS) ??
        (import.meta as any).env?.VITE_SPOTIFY_CLIENT_ID ??
        ""
      );
    } catch {
      return (import.meta as any).env?.VITE_SPOTIFY_CLIENT_ID ?? "";
    }
  }

  setClientId(id: string) {
    try {
      localStorage.setItem(CID_LS, id.trim());
    } catch {
      /* ignore */
    }
    this.emit();
  }

  /** Must match a Redirect URI registered in the Spotify dashboard EXACTLY. */
  redirectUri(): string {
    return window.location.origin + window.location.pathname;
  }

  // ---------- auth ----------
  async login(): Promise<void> {
    const cid = this.clientId;
    if (!cid) {
      this.setError("Pehle Spotify Client ID daalo (neeche dekho).");
      return;
    }
    const verifier = randomString(96);
    const challenge = await pkceChallenge(verifier);
    const state = randomString(24);
    try {
      sessionStorage.setItem(VERIFIER_SS, verifier);
      sessionStorage.setItem("salon:spotify:state", state);
    } catch {
      /* ignore */
    }
    const params = new URLSearchParams({
      response_type: "code",
      client_id: cid,
      scope: SCOPES,
      redirect_uri: this.redirectUri(),
      state,
      code_challenge_method: "S256",
      code_challenge: challenge,
    });
    window.location.href = "https://accounts.spotify.com/authorize?" + params.toString();
  }

  /** Call once on app boot. Returns true if it consumed an OAuth callback. */
  async handleCallback(): Promise<boolean> {
    const url = new URL(window.location.href);
    const code = url.searchParams.get("code");
    const err = url.searchParams.get("error");
    if (err) {
      this.setError("Spotify login failed: " + err);
      url.searchParams.delete("error");
      window.history.replaceState({}, "", url.toString());
      return true;
    }
    if (!code) return false;
    const verifier = sessionStorage.getItem(VERIFIER_SS) ?? "";
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: this.redirectUri(),
      client_id: this.clientId,
      code_verifier: verifier,
    });
    try {
      const r = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
      if (!r.ok) throw new Error("token exchange failed (" + r.status + ")");
      const j = await r.json();
      this.token = j.access_token;
      if (j.refresh_token) this.refreshToken = j.refresh_token;
      this.expAt = Date.now() + j.expires_in * 1000;
      this.persist();
      this.status.authed = true;
      this.setError(null);
    } catch (e: any) {
      this.setError("Spotify token nahi mila: " + (e?.message ?? e));
    }
    url.searchParams.delete("code");
    url.searchParams.delete("state");
    window.history.replaceState({}, "", url.toString());
    return true;
  }

  restore() {
    try {
      const raw = localStorage.getItem(AUTH_LS);
      if (!raw) return;
      const j = JSON.parse(raw);
      if (j.refresh || (j.token && Date.now() < j.expAt)) {
        this.token = j.token ?? "";
        this.refreshToken = j.refresh ?? "";
        this.expAt = j.expAt ?? 0;
        this.status.authed = true;
        this.emit();
      }
    } catch {
      /* ignore */
    }
  }

  private persist() {
    try {
      localStorage.setItem(
        AUTH_LS,
        JSON.stringify({ token: this.token, refresh: this.refreshToken, expAt: this.expAt })
      );
    } catch {
      /* ignore */
    }
  }

  private async ensureToken(): Promise<string> {
    if (this.token && Date.now() < this.expAt - 60_000) return this.token;
    if (!this.refreshToken) throw new Error("session expired — login again");
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: this.refreshToken,
      client_id: this.clientId,
    });
    const r = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!r.ok) throw new Error("refresh failed (" + r.status + ")");
    const j = await r.json();
    this.token = j.access_token;
    if (j.refresh_token) this.refreshToken = j.refresh_token;
    this.expAt = Date.now() + j.expires_in * 1000;
    this.persist();
    return this.token;
  }

  // ---------- player ----------
  private loadSdk(): Promise<void> {
    if (window.Spotify) return Promise.resolve();
    if (this.sdkPromise) return this.sdkPromise;
    this.sdkPromise = new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error("SDK load timeout")), 15000);
      window.onSpotifyWebPlaybackSDKReady = () => {
        clearTimeout(t);
        resolve();
      };
      const s = document.createElement("script");
      s.src = "https://sdk.scdn.co/spotify-player.js";
      s.async = true;
      s.onerror = () => {
        clearTimeout(t);
        reject(new Error("SDK script failed (adblocker?)"));
      };
      document.head.appendChild(s);
    });
    return this.sdkPromise;
  }

  async initPlayer(): Promise<void> {
    try {
      if (!this.status.authed) {
        this.setError("Pehle Spotify se login karo.");
        return;
      }
      await this.loadSdk();
      if (this.player) {
        try {
          this.player.disconnect();
        } catch {
          /* ignore */
        }
        this.player = null;
      }
      const player = new window.Spotify.Player({
        name: "Virtual Salon Jukebox 💈",
        getOAuthToken: (cb: (t: string) => void) => {
          this.ensureToken().then(cb).catch(() => cb(this.token));
        },
        volume: 0.8,
      });
      player.addListener("ready", ({ device_id }: any) => {
        this.deviceId = device_id;
        this.status.connected = true;
        this.setError(null);
        void this.transfer().catch(() => {});
      });
      player.addListener("not_ready", () => {
        this.status.connected = false;
        this.emit();
      });
      player.addListener("player_state_changed", (s: any) => {
        if (!s) {
          this.status.playing = false;
        } else {
          this.status.playing = !s.paused;
          const t = s.track_window?.current_track;
          this.status.track = t?.name ?? null;
          this.status.artists = t?.artists?.map((a: any) => a.name).join(", ") ?? null;
        }
        this.emit();
      });
      player.addListener("authentication_error", () => {
        this.setError("Spotify auth failed — dobara login karo.");
      });
      player.addListener("account_error", () => {
        this.setError("Web Playback needs Spotify PREMIUM.");
      });
      this.player = player;
      const ok = await player.connect();
      if (!ok) this.setError("Player connect nahi hua — retry karo.");
    } catch (e: any) {
      this.setError(e?.message ?? String(e));
    }
  }

  private async api(path: string, method = "GET", body?: unknown): Promise<any> {
    const t = await this.ensureToken();
    const r = await fetch(`https://api.spotify.com/v1${path}`, {
      method,
      headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!r.ok) throw new Error("Spotify API " + r.status);
    return r.status === 204 ? null : r.json();
  }

  async transfer(): Promise<void> {
    if (!this.deviceId) return;
    await this.api("/me/player", "PUT", { device_ids: [this.deviceId], play: false });
  }

  async togglePlay(): Promise<void> {
    try {
      if (this.player) await this.player.togglePlay();
      else await this.initPlayer();
    } catch (e: any) {
      this.setError(e?.message ?? String(e));
    }
  }

  async next(): Promise<void> {
    try {
      if (this.player) await this.player.nextTrack();
      else await this.api("/me/player/next", "POST");
    } catch (e: any) {
      this.setError(e?.message ?? String(e));
    }
  }

  async prev(): Promise<void> {
    try {
      if (this.player) await this.player.previousTrack();
      else await this.api("/me/player/previous", "POST");
    } catch (e: any) {
      this.setError(e?.message ?? String(e));
    }
  }

  logout() {
    try {
      this.player?.disconnect();
    } catch {
      /* ignore */
    }
    this.player = null;
    this.deviceId = "";
    this.token = "";
    this.refreshToken = "";
    this.expAt = 0;
    try {
      localStorage.removeItem(AUTH_LS);
    } catch {
      /* ignore */
    }
    this.status = { authed: false, connected: false, playing: false, track: null, artists: null, error: null };
    this.emit();
  }
}

export const spotifyMusic = new SpotifyMusic();
