import { io, Socket } from "socket.io-client";

export type Activity = "WALKING" | "IDLE" | "WAITING" | "GETTING_HAIRCUT" | "SITTING";
export type ChairState = "AVAILABLE" | "OCCUPIED" | "CUTTING" | "FINISHED";

export interface RemotePlayer {
  id: string;
  name: string;
  avatarId: string;
  x: number;
  z: number;
  rotY: number;
  activity: Activity;
  chairId: number | null;
  haircut: string | null;
  emote: string | null;
}

export interface QueueItem {
  id: string;
  name: string;
  avatarId: string;
  position: number;
  estWaitSec: number;
}

export interface ChairInfo {
  id: number;
  state: ChairState;
  occupantId: string | null;
  haircutType: string | null;
  startedAt: number | null;
  endsAt: number | null;
}

export interface AgentInfo {
  playerId: string;
  task: string;
  status: "IDLE" | "WORKING" | "WAITING" | "COMPLETED" | "FAILED";
  progress: number;
  etaSec: number;
  /** Which AI is on the job: "ChatGPT" | "Antigravity" | "Claude Code" | ... | "Salon Sim" */
  provider: string;
}

export interface ChatMsg {
  from: string;
  playerId?: string;
  text: string;
  ts: number;
  system?: boolean;
}

const _env = (import.meta as any).env ?? {};
const SERVER_URL =
  _env.VITE_SERVER_URL ??
  (_env.VITE_SERVER_HOST ? `https://${_env.VITE_SERVER_HOST}` : null) ??
  (typeof window !== "undefined" && window.location.hostname
    ? `http://${window.location.hostname}:3001`
    : "http://localhost:3001");

/** Same host, plain https URL (for REST calls like /api/online). */
export function serverHttpBase(): string {
  return SERVER_URL.replace(/^ws(s)?:\/\//, (_m: string, s: string) => `http${s ? "s" : ""}://`);
}

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(SERVER_URL, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1500,
    });
  }
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
