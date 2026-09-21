import { useEffect, useMemo, useRef, useState, Suspense, Component, type ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";
import { Reflector } from "three/examples/jsm/objects/Reflector.js";
import { avatarById, avatarTint, providerIcon } from "../data";
import type { AgentInfo, ChairInfo, RemotePlayer } from "../multiplayer/socket";
import { salonAudio } from "../audio/salonAudio";

// ---------- helpers: canvas textures ----------
function textTexture(
  lines: string[],
  opts?: { w?: number; h?: number; bg?: string; fg?: string; font?: string }
): THREE.CanvasTexture {
  const w = opts?.w ?? 512;
  const h = opts?.h ?? 256;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  g.fillStyle = opts?.bg ?? "#fff8e7";
  g.fillRect(0, 0, w, h);
  g.fillStyle = opts?.fg ?? "#231303";
  g.textAlign = "center";
  const font = opts?.font ?? "bold 44px sans-serif";
  g.font = font;
  const lh = h / (lines.length + 0.6);
  lines.forEach((ln, i) => g.fillText(ln, w / 2, lh * (i + 1)));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function tileTexture(): THREE.CanvasTexture {
  const s = 256;
  const c = document.createElement("canvas");
  c.width = s;
  c.height = s;
  const g = c.getContext("2d")!;
  g.fillStyle = "#e8dcc8";
  g.fillRect(0, 0, s, s);
  g.fillStyle = "#d9c9ae";
  g.fillRect(0, 0, s / 2, s / 2);
  g.fillRect(s / 2, s / 2, s / 2, s / 2);
  g.strokeStyle = "#b8a888";
  g.lineWidth = 4;
  g.strokeRect(0, 0, s, s);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(12, 10);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------- world layout ----------
export const CHAIR_POS = [
  { x: -10, z: -3.2 },
  { x: -5, z: -3.2 },
  { x: 0, z: -3.2 },
  { x: 5, z: -3.2 },
  { x: 10, z: -3.2 },
];
export const SOFA_SPOTS = [
  { x: -2.5, z: 7.75 },
  { x: -1, z: 7.75 },
  { x: 0.5, z: 7.75 },
];
export const SOFA_POS = { x: -1, z: 7.8 };
export const TABLE_POS = { x: -1, z: 5.4 };
export const DESK_POS = { x: 10.2, z: 2.5 };
export const POLE_POS = { x: 11, z: 9.5 };
// Salon room bounds (walkable) / Club room bounds (walkable)
export const SALON_BOUNDS = { minX: -11.8, maxX: 11.8, minZ: -8, maxZ: 10.2 };
export const CLUB_BOUNDS = { minX: 28.6, maxX: 51.4, minZ: -7.4, maxZ: 9.4 };
export const CLUB_X = 25; // x > this means "in the club"
export const isClubX = (x: number) => x > CLUB_X;
// Portals: salon disco door <-> club return door
export const SALON_DOOR = { x: 11.6, z: 6 };
export const CLUB_DOOR = { x: 29.6, z: 6 };

export interface Collider {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}
const SALON_COLLIDERS: Collider[] = [
  // walls
  { minX: -13, maxX: 13, minZ: -9.4, maxZ: -8.6 },
  { minX: -13, maxX: 13, minZ: 10.6, maxZ: 11.4 },
  { minX: -13.2, maxX: -12.2, minZ: -9.5, maxZ: 11.5 },
  { minX: 12.2, maxX: 13.2, minZ: -9.5, maxZ: 11.5 },
  // barber chairs (solid; sit down with E)
  ...CHAIR_POS.map((p) => ({ minX: p.x - 0.7, maxX: p.x + 0.7, minZ: p.z - 0.7, maxZ: p.z + 0.7 })),
  // reception counter
  { minX: 9.2, maxX: 11.2, minZ: 1.7, maxZ: 3.3 },
  // sofa (faces the barbers now)
  { minX: -4.2, maxX: 2.2, minZ: 7.2, maxZ: 8.4 },
  // coffee table
  { minX: -2.6, maxX: 0.4, minZ: 4.9, maxZ: 5.9 },
  // product shelves (left wall)
  { minX: -12.4, maxX: -11.4, minZ: -1, maxZ: 5 },
  // shampoo/backwash unit
  { minX: -8.9, maxX: -7.7, minZ: -6.2, maxZ: -4.8 },
  // barber pole
  { minX: 10.7, maxX: 11.3, minZ: 9.2, maxZ: 9.8 },
];
const CLUB_COLLIDERS: Collider[] = [
  // club walls
  { minX: 27, maxX: 53, minZ: -8.4, maxZ: -7.6 },
  { minX: 27, maxX: 53, minZ: 9.6, maxZ: 10.6 },
  { minX: 27.2, maxX: 28.4, minZ: -9, maxZ: 11 },
  { minX: 51.6, maxX: 52.8, minZ: -9, maxZ: 11 },
  // DJ booth
  { minX: 38.3, maxX: 41.7, minZ: -7.5, maxZ: -5.6 },
  // juice bar counter
  { minX: 49.6, maxX: 51.4, minZ: -0.5, maxZ: 4.5 },
  // speakers
  { minX: 35.3, maxX: 36.7, minZ: 5.3, maxZ: 6.7 },
  { minX: 43.3, maxX: 44.7, minZ: 5.3, maxZ: 6.7 },
];

export function inClub(x: number): boolean {
  return isClubX(x);
}

export function collide(x: number, z: number, r = 0.45): { x: number; z: number } {
  const club = isClubX(x);
  const B = club ? CLUB_BOUNDS : SALON_BOUNDS;
  const boxes = club ? CLUB_COLLIDERS : SALON_COLLIDERS;
  let nx = THREE.MathUtils.clamp(x, B.minX, B.maxX);
  let nz = THREE.MathUtils.clamp(z, B.minZ, B.maxZ);
  for (const b of boxes) {
    const cx = THREE.MathUtils.clamp(nx, b.minX, b.maxX);
    const cz = THREE.MathUtils.clamp(nz, b.minZ, b.maxZ);
    const dx = nx - cx;
    const dz = nz - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      if (d2 > 1e-6) {
        const d = Math.sqrt(d2);
        nx = cx + (dx / d) * r;
        nz = cz + (dz / d) * r;
      } else {
        const pl = nx - b.minX;
        const pr = b.maxX - nx;
        const pt = nz - b.minZ;
        const pb = b.maxZ - nz;
        const m = Math.min(pl, pr, pt, pb);
        if (m === pl) nx = b.minX - r;
        else if (m === pr) nx = b.maxX + r;
        else if (m === pt) nz = b.minZ - r;
        else nz = b.maxZ + r;
      }
    }
  }
  // never trap anyone in the void between rooms
  if (!club && nx > SALON_BOUNDS.maxX) nx = SALON_BOUNDS.maxX;
  return { x: nx, z: nz };
}

// ---------- procedural humanoid ----------
export function Humanoid({
  avatarId,
  barber = false,
  sitting = false,
  cutting = false,
  dancing = false,
  waving = false,
  moving = false,
  time = 0,
}: {
  avatarId: string;
  barber?: boolean;
  sitting?: boolean;
  cutting?: boolean;
  dancing?: boolean;
  waving?: boolean;
  moving?: boolean;
  time?: number;
}) {
  const a = avatarById(barber ? "generic" : avatarId);
  const shirt = barber ? "#f5f5f5" : a.shirt;
  const skin = barber ? "#8d5524" : a.skin;
  // --- walk-cycle state (per instance, advanced from the render clock) ---
  const cyc = useRef({ amp: 0, phase: 0, last: -1 });
  const st = cyc.current;
  if (st.last < 0) st.last = time;
  const dt = Math.min(0.1, Math.max(0, time - st.last));
  st.last = time;
  const want = moving && !sitting ? 1 : 0;
  st.amp += (want - st.amp) * Math.min(1, dt * 7);
  if (!moving && st.amp < 0.003) st.amp = 0;
  if (st.amp > 0.003) st.phase += dt * (3 + 8 * st.amp);
  const amp = st.amp;
  const ph = st.phase;
  const cutSwing = Math.sin(time * 10) * 0.55;
  const danceSwing = Math.sin(time * 6) * 0.9;
  const idleSway = Math.sin(time * 2) * 0.08;
  const armBase = cutting ? 0 : dancing ? danceSwing * 0.2 : waving ? 0 : idleSway * 0.4;
  const legSwingL = sitting ? -1.45 : dancing ? Math.sin(time * 6) * 0.35 : Math.sin(ph) * 0.65 * amp;
  const legSwingR = sitting ? -1.45 : dancing ? Math.sin(time * 6 + Math.PI) * 0.35 : Math.sin(ph + Math.PI) * 0.65 * amp;
  const armSwingL = cutting ? -0.9 + cutSwing : dancing ? -2.4 + danceSwing * 0.25 : waving ? Math.PI : -Math.sin(ph) * 0.55 * amp + armBase;
  const armSwingR = cutting ? -0.9 - cutSwing : dancing ? -2.4 - danceSwing * 0.25 : Math.sin(ph) * 0.55 * amp + armBase;
  const bob = (dancing ? Math.abs(Math.sin(time * 6)) * 0.12 : 0) + Math.abs(Math.cos(ph)) * 0.07 * amp;
  const y0 = (sitting ? -0.35 : 0) + bob;
  const lean = amp * 0.12;
  const breathe = 1 + 0.025 * Math.sin(time * 1.7) * (1 - amp);
  return (
    <group position={[0, y0, 0]} rotation={[lean, 0, 0]}>
      {/* legs (hip pivots → real walk swing) */}
      <group position={[-0.14, 0.7, 0]} rotation={[legSwingL, 0, 0]}>
        <mesh position={[0, -0.35, 0]}>
          <boxGeometry args={[0.22, 0.7, 0.24]} />
          <meshStandardMaterial color={barber ? "#3a3a3a" : a.pants} />
        </mesh>
      </group>
      <group position={[0.14, 0.7, 0]} rotation={[legSwingR, 0, 0]}>
        <mesh position={[0, -0.35, 0]}>
          <boxGeometry args={[0.22, 0.7, 0.24]} />
          <meshStandardMaterial color={barber ? "#3a3a3a" : a.pants} />
        </mesh>
      </group>
      {/* barber cape — on you the moment you sit */}
      {sitting && !barber && (
        <mesh position={[0, 0.72, 0.05]}>
          <coneGeometry args={[0.62, 1.0, 12, 1, true]} />
          <meshStandardMaterial map={barberCapeTexture()} side={THREE.DoubleSide} roughness={0.9} />
        </mesh>
      )}
      {/* torso */}
      <mesh position={[0, sitting ? 0.75 : 1.05, 0]} scale={[1, breathe, 1]}>
        <boxGeometry args={[0.62, 0.75, 0.36]} />
        <meshStandardMaterial color={shirt} />
      </mesh>
      {/* barber apron stripe */}
      {barber && (
        <mesh position={[0, sitting ? 0.75 : 1.02, 0.19]}>
          <boxGeometry args={[0.4, 0.55, 0.02]} />
          <meshStandardMaterial color="#7f4f24" />
        </mesh>
      )}
      {/* arms (shoulder pivots → counter-swing while walking) */}
      <group position={[-0.4, sitting ? 0.95 : 1.25, 0]} rotation={[armSwingL, 0, 0.15]}>
        <mesh position={[0, -0.28, 0]}>
          <boxGeometry args={[0.16, 0.6, 0.18]} />
          <meshStandardMaterial color={shirt} />
        </mesh>
        <mesh position={[0, -0.6, 0]}>
          <sphereGeometry args={[0.09, 8, 8]} />
          <meshStandardMaterial color={skin} />
        </mesh>
      </group>
      <group position={[0.4, sitting ? 0.95 : 1.25, 0]} rotation={[armSwingR, 0, -0.15]}>
        <mesh position={[0, -0.28, 0]}>
          <boxGeometry args={[0.16, 0.6, 0.18]} />
          <meshStandardMaterial color={shirt} />
        </mesh>
        <mesh position={[0, -0.6, 0]}>
          <sphereGeometry args={[0.09, 8, 8]} />
          <meshStandardMaterial color={skin} />
        </mesh>
        {(cutting || barber) && (
          <mesh position={[0, -0.62, 0.22]}>
            <boxGeometry args={[0.08, 0.08, 0.3]} />
            <meshStandardMaterial color="#222" />
          </mesh>
        )}
      </group>
      {/* head */}
      <mesh position={[0, sitting ? 1.35 : 1.68, 0]}>
        <sphereGeometry args={[0.27, 14, 14]} />
        <meshStandardMaterial color={skin} />
      </mesh>
      {/* hair */}
      {a.hairStyle === "flat" && (
        <mesh position={[0, (sitting ? 1.35 : 1.68) + 0.2, -0.02]}>
          <sphereGeometry args={[0.28, 12, 10, 0, Math.PI * 2, 0, 1.4]} />
          <meshStandardMaterial color={a.hair} />
        </mesh>
      )}
      {a.hairStyle === "spiky" && (
        <group position={[0, (sitting ? 1.35 : 1.68) + 0.26, 0]}>
          {[-0.15, -0.05, 0.05, 0.15].map((x, i) => (
            <mesh key={i} position={[x, 0.08, 0]}>
              <coneGeometry args={[0.09, 0.28, 6]} />
              <meshStandardMaterial color={a.hair} />
            </mesh>
          ))}
        </group>
      )}
      {a.hairStyle === "messy" && (
        <mesh position={[0, (sitting ? 1.35 : 1.68) + 0.22, 0]}>
          <sphereGeometry args={[0.29, 8, 6]} />
          <meshStandardMaterial color={a.hair} flatShading />
        </mesh>
      )}
      {a.hairStyle === "long" && (
        <>
          <mesh position={[0, (sitting ? 1.35 : 1.68) + 0.2, -0.02]}>
            <sphereGeometry args={[0.28, 12, 10, 0, Math.PI * 2, 0, 1.5]} />
            <meshStandardMaterial color={a.hair} />
          </mesh>
          <mesh position={[0, (sitting ? 1.0 : 1.32), -0.2]}>
            <boxGeometry args={[0.4, 0.5, 0.12]} />
            <meshStandardMaterial color={a.hair} />
          </mesh>
        </>
      )}
      {a.hairStyle === "cap" && (
        <mesh position={[0, (sitting ? 1.35 : 1.68) + 0.22, 0]}>
          <cylinderGeometry args={[0.28, 0.3, 0.14, 12]} />
          <meshStandardMaterial color="#e63946" />
        </mesh>
      )}
      {/* beard */}
      {a.beard && (
        <mesh position={[0, (sitting ? 1.35 : 1.68) - 0.14, 0.18]}>
          <boxGeometry args={[0.34, 0.2, 0.12]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
      )}
      {/* glasses / shades */}
      {(a.glasses || a.coolShade) && (
        <mesh position={[0, (sitting ? 1.35 : 1.68) + 0.03, 0.24]}>
          <boxGeometry args={[0.4, 0.1, 0.05]} />
          <meshStandardMaterial color={a.coolShade ? "#111" : "#333"} />
        </mesh>
      )}
      {/* barber moustache */}
      {barber && (
        <mesh position={[0, 1.6, 0.24]}>
          <boxGeometry args={[0.26, 0.06, 0.05]} />
          <meshStandardMaterial color="#111" />
        </mesh>
      )}
    </group>
  );
}

// ---------- free 3D models (vendored — see public/models/LICENSES.txt) ----------
// Xbot (three.js example model, Mixamo rig): real mocap walk/idle/run/agree clips.
// RobotExpressive by Tomas Laulhe (CC-BY 4.0): dance / wave / thumbsup / walking.
const BASE = import.meta.env.BASE_URL || "/";
export const XBOT_URL = `${BASE}models/Xbot.glb`;
export const ROBOT_URL = `${BASE}models/RobotExpressive.glb`;

// User-provided models (see public/models/LICENSES.txt). Detroit faces, salon hearts.
export const MODEL_FILES: Partial<Record<string, string>> = {
  female: "kara_-_detroit_become_human.glb",
  cool: "elijah_kamski_-_detroit_become_human.glb",
  bearded: "todd_-_detroit_become_human.glb",
};
export const PRELOAD_MODELS = [XBOT_URL, ROBOT_URL, ...Object.values(MODEL_FILES).map((f) => `${BASE}models/${f}`)];
const modelUrlFor = (avatarId: string) =>
  `${BASE}models/${MODEL_FILES[avatarId] ?? `avatar-${avatarId}.glb`}`;

class RigErrorBoundary extends Component<{ fallback: ReactNode; children: ReactNode; onError?: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError?.();
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function applyTint(root: THREE.Object3D, tint: string) {
  const body = new THREE.Color(tint).lerp(new THREE.Color("#ffffff"), 0.45);
  const joints = new THREE.Color("#2b2d42");
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const paint = (mm: THREE.MeshStandardMaterial) => {
      const c = mm.clone();
      const isJoint = /joint/i.test(mm.name || "");
      if (c.color) c.color.copy(isJoint ? joints : body);
      if ("roughness" in c) (c as THREE.MeshStandardMaterial).roughness = isJoint ? 0.5 : 0.65;
      return c;
    };
    const m = mesh.material as THREE.MeshStandardMaterial | THREE.MeshStandardMaterial[];
    mesh.material = Array.isArray(m) ? m.map(paint) : paint(m);
  });
}

// Classic striped barber cape (thrown over you the moment you sit down)
let capeTexCache: THREE.CanvasTexture | null = null;
function barberCapeTexture(): THREE.CanvasTexture {
  if (!capeTexCache) {
    const c = document.createElement("canvas");
    c.width = 128;
    c.height = 128;
    const g = c.getContext("2d")!;
    for (let i = 0; i < 8; i++) {
      g.fillStyle = i % 2 ? "#f5f5f5" : "#d00000";
      g.fillRect(i * 16, 0, 16, 128);
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    capeTexCache = t;
  }
  return capeTexCache;
}

// ---------- character models: Sketchfab-ready, convention over config ----------
// Drop a downloaded Sketchfab model (Animated .glb) into public/models/ named
//   avatar-<avatarId>.glb   (e.g. avatar-bearded.glb, avatar-female.glb)
// and the game uses it automatically — no code change needed. Clips are found
// by fuzzy name matching and the model is auto-scaled to ~1.7m, so most rigged
// characters just work. Xbot is the built-in fallback, the procedural body the
// last resort. (Missing optional files cause one harmless 404 each, then stop.)
const missingUrls = new Set<string>();

function findClip(anims: THREE.AnimationClip[], cands: string[]): THREE.AnimationClip | undefined {
  for (const c of cands) {
    const f = anims.find((a) => a.name.toLowerCase().includes(c));
    if (f) return f;
  }
  return undefined;
}

/** Uniform stature: scale every rig so the head bone sits at the same height.
 *  Fixes "avatars don't match the scene" no matter which file they came from. */
function fitModel(model: THREE.Group, targetHead: number): { s: number; lift: number } {
  model.updateMatrixWorld(true);
  const head =
    findBone(model, /^head$/i, /end|top|tip/i) ?? findBone(model, /head/i, /end|top|tip/i);
  let s = 1;
  if (head) {
    const v = new THREE.Vector3();
    head.getWorldPosition(v);
    if (v.y > 0.2) s = targetHead / v.y;
  } else {
    const box = new THREE.Box3().setFromObject(model);
    const h = box.max.y - box.min.y;
    if (isFinite(h) && h > 0.01) s = 1.78 / h;
  }
  const box = new THREE.Box3().setFromObject(model);
  return { s, lift: -box.min.y * s };
}
function useModelClip(model: THREE.Group, animations: THREE.AnimationClip[], candidates: string[]) {
  const mixer = useMemo(() => new THREE.AnimationMixer(model), [model]);
  const prev = useRef<THREE.AnimationAction | null>(null);
  const key = candidates.join("|").toLowerCase();
  useEffect(() => {
    const clip = findClip(animations, candidates);
    if (prev.current) {
      prev.current.fadeOut(0.25);
      prev.current = null;
    }
    if (clip) {
      const next = mixer.clipAction(clip, model);
      next.reset().fadeIn(0.25).play();
      prev.current = next;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, mixer, model, animations]);
  useEffect(() => {
    return () => {
      mixer.stopAllAction();
    };
  }, [mixer]);
  useFrame((_, delta) => mixer.update(Math.min(delta, 0.05)));
}

const WALK_C = ["walk", "stroll", "jog", "move"];
const IDLE_C = ["idle", "breath", "stand", "pose", "look"];
const RUN_C = ["run", "sprint"];
const DANCE_C = ["dance"];
const WAVE_C = ["wave", "greet", "hello", "bye", "salute"];
const AGREE_C = ["agree", "yes", "nod", "bow"];
const LAUGH_C = ["laugh", "giggle", "agree", "yes", "nod"];
const THUMB_C = ["thumb", "like", "ok", "agree", "yes"];

function emoteCandidates(moving: boolean, dancing: boolean, emote: string | null): string[] {
  if (dancing || emote === "dance") return DANCE_C;
  if (moving) return WALK_C;
  if (emote === "wave") return WAVE_C;
  if (emote === "thumbs") return THUMB_C;
  if (emote === "laugh") return LAUGH_C;
  return IDLE_C;
}

// Procedural walk for rigged models that ship no walk clip (e.g. idle-only
// Sketchfab rips): swing thighs/shins/arms directly on the bones.
interface BoneRig {
  thighL: THREE.Object3D;
  thighR: THREE.Object3D;
  shinL?: THREE.Object3D;
  shinR?: THREE.Object3D;
  uarmL?: THREE.Object3D;
  uarmR?: THREE.Object3D;
  farmL?: THREE.Object3D;
  farmR?: THREE.Object3D;
}

function findBone(model: THREE.Group, re: RegExp, exclude?: RegExp): THREE.Object3D | undefined {
  let found: THREE.Object3D | undefined;
  model.traverse((o) => {
    if (found || !(o as any).isBone) return;
    if (re.test(o.name) && !(exclude && exclude.test(o.name))) found = o;
  });
  return found;
}

function useBoneWalk(model: THREE.Group, moving: boolean) {
  const rig = useMemo(() => {
    const thighL = findBone(model, /left.*(upleg|thigh)/i);
    const thighR = findBone(model, /right.*(upleg|thigh)/i);
    if (!thighL || !thighR) return null;
    const noUp = /upleg|thigh/i;
    const b: BoneRig = {
      thighL,
      thighR,
      shinL: findBone(model, /left.*(leg|shin|calf)/i, noUp),
      shinR: findBone(model, /right.*(leg|shin|calf)/i, noUp),
      uarmL: findBone(model, /left.*upperarm/i),
      uarmR: findBone(model, /right.*upperarm/i),
      farmL: findBone(model, /left.*forearm/i),
      farmR: findBone(model, /right.*forearm/i),
    };
    const base = new Map<THREE.Object3D, THREE.Euler>();
    Object.values(b).forEach((bone) => {
      if (bone) base.set(bone, bone.rotation.clone());
    });
    return { b, base, phase: 0, amp: 0 };
  }, [model]);
  useFrame((_, delta) => {
    if (!rig) return;
    const dt = Math.min(delta, 0.05);
    rig.amp += ((moving ? 1 : 0) - rig.amp) * Math.min(1, dt * 6);
    if (rig.amp < 0.003 && !moving) {
      if (rig.amp !== 0) {
        rig.amp = 0;
        rig.base.forEach((e, bone) => bone.rotation.copy(e));
      }
      return;
    }
    rig.phase += dt * 9;
    const { b, base, phase: ph, amp } = rig;
    const put = (bone: THREE.Object3D | undefined, x: number) => {
      if (!bone) return;
      const e = base.get(bone)!;
      bone.rotation.set(e.x + x, e.y, e.z);
    };
    const s = Math.sin(ph);
    const c = Math.sin(ph + Math.PI);
    put(b.thighL, s * 0.6 * amp);
    put(b.thighR, c * 0.6 * amp);
    put(b.shinL, Math.max(0, Math.sin(ph - 0.9)) * 0.9 * amp);
    put(b.shinR, Math.max(0, Math.sin(ph + Math.PI - 0.9)) * 0.9 * amp);
    put(b.uarmL, c * 0.45 * amp);
    put(b.uarmR, s * 0.45 * amp);
    put(b.farmL, c * 0.25 * amp);
    put(b.farmR, s * 0.25 * amp);
  });
}

// Bone-driven DANCE for rigs with no dance clip (Xbot, idle-only files).
// X/Y-axis moves only (safe on any humanoid bind pose); the pattern rotates
// every few bars so the club doesn't look like one move on loop.
function useBoneDance(model: THREE.Group, dancing: boolean) {
  const rig = useMemo(() => {
    const spine = findBone(model, /spine\d*$/i) ?? findBone(model, /spine/i);
    const neck = findBone(model, /neck/i);
    const head = findBone(model, /^head$/i, /end|top|tip/i);
    const thighL = findBone(model, /left.*(upleg|thigh)/i);
    const thighR = findBone(model, /right.*(upleg|thigh)/i);
    if (!thighL || !thighR) return null;
    const noUp = /upleg|thigh/i;
    const b = {
      spine,
      neck,
      head,
      thighL,
      thighR,
      shinL: findBone(model, /left.*(leg|shin|calf)/i, noUp),
      shinR: findBone(model, /right.*(leg|shin|calf)/i, noUp),
      uarmL: findBone(model, /left.*upperarm/i),
      uarmR: findBone(model, /right.*upperarm/i),
      farmL: findBone(model, /left.*forearm/i),
      farmR: findBone(model, /right.*forearm/i),
    };
    const base = new Map<THREE.Object3D, THREE.Euler>();
    Object.values(b).forEach((bone) => {
      if (bone) base.set(bone, bone.rotation.clone());
    });
    return { b, base, phase: Math.random() * 6, amp: 0 };
  }, [model]);
  useFrame((_, delta) => {
    if (!rig) return;
    const dt = Math.min(delta, 0.05);
    rig.amp += ((dancing ? 1 : 0) - rig.amp) * Math.min(1, dt * 5);
    if (rig.amp < 0.003 && !dancing) {
      if (rig.amp !== 0) {
        rig.amp = 0;
        rig.base.forEach((e, bone) => bone.rotation.copy(e));
      }
      return;
    }
    rig.phase += dt * 7;
    const { b, base, phase: ph, amp } = rig;
    const put = (bone: THREE.Object3D | undefined, dx: number, dy = 0, dz = 0) => {
      if (!bone) return;
      const e = base.get(bone)!;
      bone.rotation.set(e.x + dx, e.y + dy, e.z + dz);
    };
    const s = Math.sin(ph);
    const c = Math.sin(ph + Math.PI);
    const s2 = Math.sin(ph * 2);
    const move = Math.floor(ph / (Math.PI * 6)) % 3;
    if (move === 0) {
      // bounce: big arm pumps, knee bounce, head nod
      put(b.thighL, s * 0.35 * amp);
      put(b.thighR, c * 0.35 * amp);
      put(b.shinL, Math.max(0, Math.sin(ph - 0.9)) * 0.5 * amp);
      put(b.shinR, Math.max(0, Math.sin(ph + Math.PI - 0.9)) * 0.5 * amp);
      put(b.uarmL, c * 0.7 * amp);
      put(b.uarmR, s * 0.7 * amp);
      put(b.farmL, -0.4 * amp + c * 0.2 * amp);
      put(b.farmR, -0.4 * amp + s * 0.2 * amp);
      put(b.spine, 0.08 * amp + Math.abs(s) * 0.05 * amp);
      put(b.head, s2 * 0.15 * amp);
    } else if (move === 1) {
      // side sway
      const sway = Math.sin(ph * 0.5);
      put(b.spine, 0.05 * amp, 0, sway * 0.28 * amp);
      put(b.thighL, s * 0.28 * amp);
      put(b.thighR, c * 0.28 * amp);
      put(b.uarmL, c * 0.5 * amp);
      put(b.uarmR, s * 0.5 * amp);
      put(b.head, 0, 0, sway * 0.12 * amp);
      put(b.neck, s2 * 0.08 * amp);
    } else {
      // twist: torso twist, knees together bounce, forearm pump
      put(b.spine, 0.06 * amp, s * 0.5 * amp);
      const j = Math.abs(s);
      put(b.thighL, j * 0.3 * amp);
      put(b.thighR, j * 0.3 * amp);
      put(b.shinL, j * 0.4 * amp);
      put(b.shinR, j * 0.4 * amp);
      put(b.farmL, -0.6 * amp + s2 * 0.25 * amp);
      put(b.farmR, -0.6 * amp - s2 * 0.25 * amp);
      put(b.head, 0, c * 0.2 * amp);
    }
  });
}

function XbotModel({ avatarId, moving, dancing, emote, sitting }: { avatarId: string; moving: boolean; dancing: boolean; emote: string | null; sitting: boolean }) {
  const { scene, animations } = useGLTF(XBOT_URL) as unknown as { scene: THREE.Group; animations: THREE.AnimationClip[] };
  const model = useMemo(() => {
    const c = SkeletonUtils.clone(scene) as THREE.Group;
    applyTint(c, avatarTint(avatarId));
    return c;
  }, [scene, avatarId]);
  useModelClip(
    model,
    animations,
    sitting ? ["sitting", "sit", "seated"] : dancing ? RUN_C : moving ? WALK_C : emote ? AGREE_C : IDLE_C
  );
  // Xbot ships no dance clip → bone-driven club moves instead of run-in-place
  useBoneDance(model, dancing && !sitting);
  const fit = useMemo(() => fitModel(model, 1.64), [model]);
  return (
    <group scale={fit.s} position={[0, fit.lift, 0]}>
      <primitive object={model} />
    </group>
  );
}

function RobotModel({ moving, emote, sitting }: { moving: boolean; emote: string | null; sitting: boolean }) {
  const { scene, animations } = useGLTF(ROBOT_URL) as unknown as { scene: THREE.Group; animations: THREE.AnimationClip[] };
  const model = useMemo(() => SkeletonUtils.clone(scene) as THREE.Group, [scene]);
  const cands = sitting
    ? ["sitting"]
    : emote === "dance"
      ? ["dance"]
      : emote === "wave"
        ? ["wave"]
        : emote === "thumbs"
          ? ["thumbsup"]
          : emote === "laugh"
            ? ["yes"]
            : moving
              ? ["walking", "walk"]
              : ["idle"];
  useModelClip(model, animations, cands);
  const fit = useMemo(() => fitModel(model, 1.38), [model]);
  return (
    <group scale={fit.s} position={[0, fit.lift, 0]}>
      <primitive object={model} />
    </group>
  );
}

/** User-provided Sketchfab model: textures preserved, auto-scaled to ~1.7m. */
function CustomModel({ url, moving, dancing, emote, sitting }: { url: string; moving: boolean; dancing: boolean; emote: string | null; sitting: boolean }) {
  const { scene, animations } = useGLTF(url) as unknown as { scene: THREE.Group; animations: THREE.AnimationClip[] };
  const model = useMemo(() => SkeletonUtils.clone(scene) as THREE.Group, [scene]);
  const hasWalk = useMemo(() => !!findClip(animations, WALK_C), [animations]);
  const hasDance = useMemo(() => !!findClip(animations, DANCE_C), [animations]);
  useModelClip(
    model,
    animations,
    sitting ? ["sitting", "sit", "seated"] : emoteCandidates(moving, dancing, emote)
  );
  // bone-driven stride when the file ships no walk clip (idle-only rips)
  useBoneWalk(model, moving && !hasWalk && !sitting);
  // bone-driven club moves when the file ships no dance clip
  useBoneDance(model, dancing && !hasDance && !sitting);
  const fit = useMemo(() => fitModel(model, 1.64), [model]);
  return (
    <group scale={fit.s} position={[0, fit.lift, 0]}>
      <primitive object={model} />
    </group>
  );
}

// Seated customer, actual model: lowered under a big barber cape, head out.
// (How it looks IRL too — cape swallows everything but the face.)
function SeatedWrap({ children }: { children: ReactNode }) {
  return (
    <group>
      <group position={[0, -0.34, 0]}>{children}</group>
      <mesh position={[0, 0.35, 0.06]}>
        <coneGeometry args={[0.9, 1.5, 12, 1, true]} />
        <meshStandardMaterial map={barberCapeTexture()} side={THREE.DoubleSide} roughness={0.9} />
      </mesh>
      <mesh position={[0, 1.12, 0.05]} rotation={[Math.PI / 2.3, 0, 0]}>
        <torusGeometry args={[0.24, 0.07, 8, 14]} />
        <meshStandardMaterial color="#f5f5f5" roughness={0.9} />
      </mesh>
    </group>
  );
}

/** Picks the best rig: free GLB model when standing, procedural body when seated. */
export function AvatarRig({
  avatarId,
  moving,
  sitting,
  dancing,
  waving,
  emote,
  time,
}: {
  avatarId: string;
  moving: boolean;
  sitting: boolean;
  dancing: boolean;
  waving: boolean;
  emote: string | null;
  time: number;
}) {
  if (sitting && avatarId !== "robot") {
    return <Humanoid avatarId={avatarId} sitting moving={false} dancing={dancing} waving={waving} time={time} />;
  }
  const fallback = (
    <Humanoid avatarId={avatarId} sitting={sitting} moving={moving} dancing={dancing} waving={waving} time={time} />
  );
  if (avatarId === "robot") {
    // robot ships a real Sitting clip, so it sits properly on its own
    const r = <RobotModel moving={moving} emote={emote} sitting={sitting} />;
    return (
      <RigErrorBoundary fallback={fallback}>
        <Suspense fallback={fallback}>{r}</Suspense>
      </RigErrorBoundary>
    );
  }
  // custom Sketchfab model if the user dropped one in, else built-in Xbot
  const customUrl = modelUrlFor(avatarId);
  const standing = <XbotModel avatarId={avatarId} moving={moving} dancing={dancing} emote={emote} sitting={false} />;
  const seatedXbot = (
    <SeatedWrap>
      <XbotModel avatarId={avatarId} moving={false} dancing={false} emote={null} sitting />
    </SeatedWrap>
  );
  if (sitting) {
    if (missingUrls.has(customUrl)) return seatedXbot;
    return (
      <RigErrorBoundary fallback={fallback}>
        <Suspense fallback={fallback}>
          <RigErrorBoundary fallback={seatedXbot} onError={() => missingUrls.add(customUrl)}>
            <SeatedWrap>
              <CustomModel url={customUrl} moving={false} dancing={false} emote={null} sitting />
            </SeatedWrap>
          </RigErrorBoundary>
        </Suspense>
      </RigErrorBoundary>
    );
  }
  if (missingUrls.has(customUrl)) return standing;
  return (
    <RigErrorBoundary fallback={fallback}>
      <Suspense fallback={standing}>
        <RigErrorBoundary fallback={standing} onError={() => missingUrls.add(customUrl)}>
          <CustomModel url={customUrl} moving={moving} dancing={dancing} emote={emote} sitting={false} />
        </RigErrorBoundary>
      </Suspense>
    </RigErrorBoundary>
  );
}

// Real planar-reflection mirror — yes, you can actually see yourself getting cut. 💈
function Mirror({ position }: { position: [number, number, number] }) {
  const mesh = useMemo(
    () =>
      new Reflector(new THREE.PlaneGeometry(2.2, 1.9), {
        textureWidth: 512,
        textureHeight: 512,
        color: 0x8a949e,
        clipBias: 0.003,
      }),
    []
  );
  useEffect(
    () => () => {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    },
    [mesh]
  );
  return <primitive object={mesh} position={position} />;
}

// Marigold toran (flower garland) — hangs over every mirror
function Toran({ x, y, z }: { x: number; y: number; z: number }) {
  const cols = ["#ff9f1c", "#ffbf69", "#e36414", "#ffd60a"];
  const flowers = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    flowers.push({ x: x - 1.1 + (t * 2.2), y: y - Math.sin(t * Math.PI) * 0.26, c: cols[i % cols.length] });
  }
  return (
    <group>
      <mesh position={[x, y + 0.03, z]}>
        <boxGeometry args={[2.3, 0.03, 0.03]} />
        <meshStandardMaterial color="#5a3d1b" />
      </mesh>
      {flowers.map((f, i) => (
        <mesh key={i} position={[f.x, f.y, z]}>
          <sphereGeometry args={[0.075, 7, 6]} />
          <meshStandardMaterial color={f.c} />
        </mesh>
      ))}
    </group>
  );
}

// ---------- static environment ----------
function Environment({ time }: { time: number }) {
  const floorTex = useMemo(() => tileTexture(), []);
  const priceTex = useMemo(
    () =>
      textTexture(["✂️ RATE CARD ✂️", "Normal Cut ₹150", "Fade ₹250", "Beard ₹350", "Champi ₹300"], {
        bg: "#231303",
        fg: "#ffb703",
        font: "bold 40px sans-serif",
      }),
    []
  );
  const noCreditTex = useMemo(
    () => textTexture(["NO CREDIT", "PLEASE 🙏"], { bg: "#e63946", fg: "#fff", font: "bold 64px sans-serif" }),
    []
  );
  const waitTex = useMemo(
    () =>
      textTexture(["PLEASE WAIT", "FOR YOUR TURN"], { bg: "#fff8e7", fg: "#9d0208", font: "bold 52px sans-serif" }),
    []
  );
  const specialTex = useMemo(
    () =>
      textTexture(["TODAY'S SPECIAL", "NORMAL CUT ₹150"], { bg: "#ffb703", fg: "#231303", font: "bold 46px sans-serif" }),
    []
  );
  const filmiTex = useMemo(
    () =>
      textTexture(["★ FILMI ★", "STYLE SALOON", "EST. 1998"], { bg: "#370617", fg: "#ffba08", font: "bold 56px sans-serif" }),
    []
  );
  const calendarTex = useMemo(
    () => textTexture(["📅 2026", "STYLE SALOON", "Bandra West"], { bg: "#9d0208", fg: "#ffd60a", font: "bold 52px sans-serif" }),
    []
  );
  const shubhTex = useMemo(
    () => textTexture(["🪔 SHUBH LABH 🪔"], { bg: "#ffb703", fg: "#7f4f24", font: "bold 54px sans-serif" }),
    []
  );
  const welcomeTex = useMemo(
    () => textTexture(["W E L C O M E 🙏"], { bg: "#fff8e7", fg: "#9d0208", font: "bold 60px sans-serif" }),
    []
  );
  const poleSignTex = useMemo(
    () => textTexture(["HAIR CUT ✂️"], { bg: "#231303", fg: "#ffb703", font: "bold 52px sans-serif" }),
    []
  );
  const discoTex = useMemo(
    () => textTexture(["🪩 DISCO →"], { bg: "#12041f", fg: "#ff2fb3", font: "bold 60px sans-serif" }),
    []
  );
  const clubNeonTex = useMemo(
    () =>
      textTexture(["★ CLUB BOLLYWOOD ★", "DISCO • DHAMAKA • DANCE"], {
        bg: "#0a0a1a",
        fg: "#ff2fb3",
        font: "bold 52px sans-serif",
      }),
    []
  );
  const salonBackTex = useMemo(
    () => textTexture(["← SALON 💈"], { bg: "#231303", fg: "#ffb703", font: "bold 60px sans-serif" }),
    []
  );
  const poleTex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 64;
    c.height = 64;
    const g = c.getContext("2d")!;
    g.fillStyle = "#f5f5f5";
    g.fillRect(0, 0, 64, 64);
    const stripe = (color: string, w: number, off: number) => {
      g.fillStyle = color;
      for (let i = -2; i < 6; i++) {
        g.save();
        g.translate(i * 24 + off, 0);
        g.rotate(Math.PI / 5);
        g.fillRect(0, -20, w, 110);
        g.restore();
      }
    };
    stripe("#d00000", 10, 0);
    stripe("#1d4ed8", 5, 12);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(2, 2);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);

  return (
    <group>
      {/* floor + ceiling */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 1]} receiveShadow>
        <planeGeometry args={[26, 22]} />
        <meshStandardMaterial map={floorTex} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 4.4, 1]}>
        <planeGeometry args={[26, 22]} />
        <meshStandardMaterial color="#caa77b" />
      </mesh>
      {/* walls */}
      <mesh position={[0, 2.2, -9]}>
        <boxGeometry args={[26, 4.4, 0.3]} />
        <meshStandardMaterial color="#f1e3c6" />
      </mesh>
      <mesh position={[0, 2.2, 11]}>
        <boxGeometry args={[26, 4.4, 0.3]} />
        <meshStandardMaterial color="#e5cfa8" />
      </mesh>
      <mesh position={[-12.5, 2.2, 1]}>
        <boxGeometry args={[0.3, 4.4, 20.5]} />
        <meshStandardMaterial color="#efd9b4" />
      </mesh>
      <mesh position={[12.5, 2.2, 1]}>
        <boxGeometry args={[0.3, 4.4, 20.5]} />
        <meshStandardMaterial color="#efd9b4" />
      </mesh>
      {/* red-white barber stripe awning inside */}
      <mesh position={[0, 4.0, -8.8]}>
        <boxGeometry args={[25, 0.5, 0.15]} />
        <meshStandardMaterial color="#e63946" />
      </mesh>
      {/* two-tone Indian-shop walls: green dado + gold border */}
      <mesh position={[0, 0.575, -8.81]}>
        <boxGeometry args={[26, 1.15, 0.06]} />
        <meshStandardMaterial color="#386641" />
      </mesh>
      <mesh position={[0, 1.18, -8.81]}>
        <boxGeometry args={[26, 0.07, 0.07]} />
        <meshStandardMaterial color="#ffb703" />
      </mesh>
      <mesh position={[0, 0.575, 10.81]}>
        <boxGeometry args={[26, 1.15, 0.06]} />
        <meshStandardMaterial color="#386641" />
      </mesh>
      <mesh position={[0, 1.18, 10.81]}>
        <boxGeometry args={[26, 0.07, 0.07]} />
        <meshStandardMaterial color="#ffb703" />
      </mesh>
      <mesh position={[-12.31, 0.575, 1]}>
        <boxGeometry args={[0.06, 1.15, 20]} />
        <meshStandardMaterial color="#386641" />
      </mesh>
      <mesh position={[-12.31, 1.18, 1]}>
        <boxGeometry args={[0.07, 0.07, 20]} />
        <meshStandardMaterial color="#ffb703" />
      </mesh>
      <mesh position={[12.31, 0.575, 1]}>
        <boxGeometry args={[0.06, 1.15, 20]} />
        <meshStandardMaterial color="#386641" />
      </mesh>
      <mesh position={[12.31, 1.18, 1]}>
        <boxGeometry args={[0.07, 0.07, 20]} />
        <meshStandardMaterial color="#ffb703" />
      </mesh>

      {/* mirrors + stations */}
      {CHAIR_POS.map((p, i) => (
        <group key={i}>
          <Mirror position={[p.x, 2.1, -8.78]} />
          <mesh position={[p.x, 2.1, -8.84]}>
            <boxGeometry args={[2.5, 2.2, 0.08]} />
            <meshStandardMaterial color="#7f4f24" />
          </mesh>
          {/* station shelf */}
          <mesh position={[p.x + 1.35, 1.0, -8.4]}>
            <boxGeometry args={[0.5, 0.08, 0.5]} />
            <meshStandardMaterial color="#6c4a2a" />
          </mesh>
          {/* spray bottle */}
          <mesh position={[p.x + 1.3, 1.2, -8.4]}>
            <cylinderGeometry args={[0.06, 0.08, 0.28, 8]} />
            <meshStandardMaterial color="#4cc9f0" />
          </mesh>
          {/* comb */}
          <mesh position={[p.x + 1.45, 1.06, -8.4]}>
            <boxGeometry args={[0.16, 0.03, 0.05]} />
            <meshStandardMaterial color="#e63946" />
          </mesh>
          {/* towel stack */}
          <mesh position={[p.x - 1.35, 0.95, -8.4]}>
            <boxGeometry args={[0.45, 0.18, 0.4]} />
            <meshStandardMaterial color="#fff8e7" />
          </mesh>
          {/* barber chair */}
          <group position={[p.x, 0, p.z]}>
            <mesh position={[0, 0.25, 0]}>
              <cylinderGeometry args={[0.45, 0.55, 0.15, 12]} />
              <meshStandardMaterial color="#3a3a3a" />
            </mesh>
            <mesh position={[0, 0.55, 0]}>
              <boxGeometry args={[0.85, 0.25, 0.85]} />
              <meshStandardMaterial color="#9d0208" />
            </mesh>
            <mesh position={[0, 1.1, -0.5]} rotation={[0.15, 0, 0]}>
              <boxGeometry args={[0.85, 1.0, 0.22]} />
              <meshStandardMaterial color="#9d0208" />
            </mesh>
            <mesh position={[-0.55, 0.75, 0]}>
              <boxGeometry args={[0.12, 0.12, 0.8]} />
              <meshStandardMaterial color="#c9a87a" />
            </mesh>
            <mesh position={[0.55, 0.75, 0]}>
              <boxGeometry args={[0.12, 0.12, 0.8]} />
              <meshStandardMaterial color="#c9a87a" />
            </mesh>
            {/* footrest */}
            <mesh position={[0, 0.35, 0.65]}>
              <boxGeometry args={[0.5, 0.08, 0.3]} />
              <meshStandardMaterial color="#888" metalness={0.6} roughness={0.4} />
            </mesh>
            {/* chair number */}
            <Html position={[0, 1.9, 0]} center distanceFactor={10}>
              <div style={{ background: "#00000099", color: "#ffb703", fontSize: 11, padding: "2px 8px", borderRadius: 8 }}>
                CHAIR {i + 1}
              </div>
            </Html>
          </group>
        </group>
      ))}

      {/* marigold torans over every mirror */}
      {CHAIR_POS.map((p, i) => (
        <Toran key={`toran-${i}`} x={p.x} y={3.32} z={-8.62} />
      ))}

      {/* waiting sofa (faces the barbers) + coffee table + magazines + chai */}
      <group position={[SOFA_POS.x, 0, SOFA_POS.z]} rotation={[0, Math.PI, 0]}>
        <mesh position={[0, 0.35, 0]}>
          <boxGeometry args={[6.4, 0.5, 1.1]} />
          <meshStandardMaterial color="#6d597a" />
        </mesh>
        <mesh position={[0, 0.9, -0.5]}>
          <boxGeometry args={[6.4, 0.9, 0.3]} />
          <meshStandardMaterial color="#5a4a68" />
        </mesh>
        {[-2.2, 0, 2.2].map((x, i) => (
          <mesh key={i} position={[x, 0.75, -0.35]}>
            <boxGeometry args={[1.6, 0.5, 0.15]} />
            <meshStandardMaterial color={["#e5989b", "#b5838d", "#ffb4a2"][i]} />
          </mesh>
        ))}
      </group>
      <group position={[TABLE_POS.x, 0, TABLE_POS.z]}>
        <mesh position={[0, 0.4, 0]}>
          <boxGeometry args={[2.6, 0.12, 0.9]} />
          <meshStandardMaterial color="#6c4a2a" />
        </mesh>
        <mesh position={[-1, 0.2, 0]}>
          <boxGeometry args={[0.12, 0.4, 0.7]} />
          <meshStandardMaterial color="#4a3728" />
        </mesh>
        {/* newspaper */}
        <mesh position={[0.3, 0.5, 0.1]} rotation={[-0.2, 0.4, 0]}>
          <boxGeometry args={[0.5, 0.04, 0.35]} />
          <meshStandardMaterial color="#f5f5f5" />
        </mesh>
        {/* cutting chai tray */}
        <mesh position={[-0.7, 0.48, 0]}>
          <boxGeometry args={[0.55, 0.03, 0.32]} />
          <meshStandardMaterial color="#8a8a8a" metalness={0.6} roughness={0.4} />
        </mesh>
        {[-0.85, -0.7, -0.55].map((x, i) => (
          <mesh key={i} position={[x, 0.55, 0]}>
            <cylinderGeometry args={[0.045, 0.035, 0.1, 10]} />
            <meshStandardMaterial color="#c97b2d" transparent opacity={0.92} />
          </mesh>
        ))}
      </group>

      {/* rotating barber pole near the entrance */}
      <group position={[POLE_POS.x, 0, POLE_POS.z]}>
        <mesh position={[0, 0.15, 0]}>
          <cylinderGeometry args={[0.3, 0.36, 0.3, 12]} />
          <meshStandardMaterial color="#231303" />
        </mesh>
        <mesh position={[0, 1.5, 0]} rotation={[0, time * 2.2, 0]}>
          <cylinderGeometry args={[0.22, 0.22, 1.15, 14]} />
          <meshStandardMaterial map={poleTex} />
        </mesh>
        <mesh position={[0, 2.15, 0]}>
          <sphereGeometry args={[0.24, 10, 8]} />
          <meshStandardMaterial color="#231303" />
        </mesh>
        <mesh position={[0, 2.62, 0]} rotation={[0, Math.PI, 0]}>
          <planeGeometry args={[1.5, 0.5]} />
          <meshStandardMaterial map={poleSignTex} />
        </mesh>
      </group>

      {/* shampoo / backwash unit (left wall) */}
      <group position={[-8.3, 0, -5.5]} rotation={[0, Math.PI / 2, 0]}>
        <mesh position={[0, 0.35, 0.2]}>
          <boxGeometry args={[0.7, 0.25, 0.9]} />
          <meshStandardMaterial color="#1d3557" />
        </mesh>
        <mesh position={[0, 0.7, -0.4]} rotation={[-0.5, 0, 0]}>
          <boxGeometry args={[0.7, 0.8, 0.22]} />
          <meshStandardMaterial color="#1d3557" />
        </mesh>
        <mesh position={[0, 0.45, -0.1]}>
          <cylinderGeometry args={[0.12, 0.16, 0.5, 10]} />
          <meshStandardMaterial color="#888" />
        </mesh>
        <mesh position={[0, 0.95, -0.55]}>
          <cylinderGeometry args={[0.36, 0.28, 0.28, 14]} />
          <meshStandardMaterial color="#f5f5f5" />
        </mesh>
        <mesh position={[0, 1.2, -0.55]}>
          <boxGeometry args={[0.08, 0.18, 0.08]} />
          <meshStandardMaterial color="#bbb" metalness={0.7} roughness={0.3} />
        </mesh>
      </group>

      {/* tube lights with desi flicker */}
      {[
        { z: 4 },
        { z: -4 },
      ].map((tl, ti) => (
        <group key={ti} position={[0, 4.28, tl.z]}>
          <mesh>
            <boxGeometry args={[2.3, 0.07, 0.3]} />
            <meshStandardMaterial color="#ddd" />
          </mesh>
          <mesh position={[0, -0.06, 0]}>
            <boxGeometry args={[2.0, 0.05, 0.12]} />
            <meshStandardMaterial
              color="#fff8e7"
              emissive="#fff3d6"
              emissiveIntensity={Math.sin(time * 37 + ti * 2) > 0.96 ? 0.3 : 1.8}
            />
          </mesh>
        </group>
      ))}

      {/* waiting-area rug */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-1, 0.012, 7.6]}>
        <circleGeometry args={[2.3, 28]} />
        <meshStandardMaterial color="#9d0208" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-1, 0.016, 7.6]}>
        <circleGeometry args={[1.6, 28]} />
        <meshStandardMaterial color="#e9c46a" />
      </mesh>

      {/* calendar + shubh-labh + welcome on the entrance wall */}
      <mesh position={[-4.5, 2.62, 10.82]} rotation={[0, Math.PI, 0]}>
        <boxGeometry args={[1.0, 1.3, 0.06]} />
        <meshStandardMaterial color="#5a3d1b" />
      </mesh>
      <mesh position={[-4.5, 2.62, 10.78]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[0.88, 1.18]} />
        <meshStandardMaterial map={calendarTex} />
      </mesh>
      <mesh position={[-2.6, 2.7, 10.8]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[2.2, 0.7]} />
        <meshStandardMaterial map={shubhTex} />
      </mesh>
      <mesh position={[0, 3.35, 10.8]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[2.6, 0.6]} />
        <meshStandardMaterial map={welcomeTex} />
      </mesh>
      <mesh position={[12.3, 2.6, -1]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[1.8, 0.6]} />
        <meshStandardMaterial map={poleSignTex} />
      </mesh>

      {/* disco portal door (right wall) — walk up & press E */}
      <group position={[12.28, 0, 6]}>
        {/* protruding golden arch */}
        <mesh position={[-0.35, 1.5, -1.2]}>
          <boxGeometry args={[0.7, 3.2, 0.35]} />
          <meshStandardMaterial color="#ffb703" emissive="#ffb703" emissiveIntensity={0.25} />
        </mesh>
        <mesh position={[-0.35, 1.5, 1.2]}>
          <boxGeometry args={[0.7, 3.2, 0.35]} />
          <meshStandardMaterial color="#ffb703" emissive="#ffb703" emissiveIntensity={0.25} />
        </mesh>
        <mesh position={[-0.35, 3.15, 0]}>
          <boxGeometry args={[0.7, 0.35, 2.75]} />
          <meshStandardMaterial color="#ffb703" emissive="#ffb703" emissiveIntensity={0.25} />
        </mesh>
        {/* glowing portal */}
        <mesh position={[-0.1, 1.45, 0]} rotation={[0, -Math.PI / 2, 0]}>
          <circleGeometry args={[1.05 + 0.06 * Math.sin(time * 4), 28]} />
          <meshStandardMaterial color="#0a0616" emissive="#a855f7" emissiveIntensity={1.4} transparent opacity={0.92} />
        </mesh>
        <mesh position={[-0.1, 3.35, 0]} rotation={[0, -Math.PI / 2, 0]}>
          <planeGeometry args={[2.2, 0.7]} />
          <meshStandardMaterial map={discoTex} emissive="#ffffff" emissiveMap={discoTex} emissiveIntensity={0.9} />
        </mesh>
        {/* red-carpet threshold */}
        <mesh position={[-0.9, 0.02, 0]}>
          <boxGeometry args={[1.6, 0.04, 2.0]} />
          <meshStandardMaterial color="#9d0208" />
        </mesh>
        <pointLight position={[-1.2, 2.2, 0]} intensity={8} distance={7} color="#c084fc" />
        <Html position={[-0.6, 4.1 + 0.12 * Math.sin(time * 2.5), 0]} center distanceFactor={12}>
          <div style={{ fontSize: 26 }}>🪩</div>
        </Html>
      </group>

      {/* reception counter + cash + plant */}
      <group position={[DESK_POS.x, 0, DESK_POS.z]}>
        <mesh position={[0, 0.6, 0]}>
          <boxGeometry args={[2.2, 1.2, 1.4]} />
          <meshStandardMaterial color="#7f4f24" />
        </mesh>
        <mesh position={[0, 1.25, 0]}>
          <boxGeometry args={[2.4, 0.1, 1.6]} />
          <meshStandardMaterial color="#a67c52" />
        </mesh>
        <Html position={[0, 1.9, 0]} center distanceFactor={18}>
          <div style={{ background: "#231303ee", color: "#ffb703", fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999, whiteSpace: "nowrap", border: "1px solid #ffb70366" }}>
            💈 RECEPTION — press E
          </div>
        </Html>
      </group>
      <group position={[6.5, 0, 0.5]}>
        <mesh position={[0, 0.25, 0]}>
          <cylinderGeometry args={[0.25, 0.3, 0.5, 10]} />
          <meshStandardMaterial color="#b5651d" />
        </mesh>
        <mesh position={[0, 0.8, 0]}>
          <coneGeometry args={[0.45, 0.9, 8]} />
          <meshStandardMaterial color="#2d6a4f" />
        </mesh>
      </group>

      {/* product shelves left wall */}
      {[-0.5, 0.4, 1.3].map((y, r) => (
        <group key={r} position={[-11.9, 1.1 + y, 2]}>
          <mesh>
            <boxGeometry args={[0.5, 0.08, 4.5]} />
            <meshStandardMaterial color="#6c4a2a" />
          </mesh>
          {[-1.6, -0.8, 0, 0.8, 1.6].map((z, i) => (
            <mesh key={i} position={[0, 0.2, z]}>
              <boxGeometry args={[0.28, 0.32, 0.28]} />
              <meshStandardMaterial color={["#e63946", "#ffb703", "#4cc9f0", "#80ed99", "#ff5d8f"][i]} />
            </mesh>
          ))}
        </group>
      ))}

      {/* posters / boards */}
      <mesh position={[-6.5, 2.6, -8.82]}>
        <planeGeometry args={[2.6, 1.3]} />
        <meshStandardMaterial map={priceTex} />
      </mesh>
      <mesh position={[6.5, 2.6, -8.82]}>
        <planeGeometry args={[2.4, 1.2]} />
        <meshStandardMaterial map={specialTex} />
      </mesh>
      <mesh position={[12.32, 2.4, 4.5]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[2.2, 1.1]} />
        <meshStandardMaterial map={noCreditTex} />
      </mesh>
      <mesh position={[-12.32, 2.4, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[2.4, 1.2]} />
        <meshStandardMaterial map={waitTex} />
      </mesh>
      <mesh position={[3.2, 2.6, 10.83]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[2.6, 1.3]} />
        <meshStandardMaterial map={filmiTex} />
      </mesh>

      {/* wall clock */}
      <group position={[0, 3.4, -8.8]}>
        <mesh>
          <cylinderGeometry args={[0.35, 0.35, 0.08, 20]} />
          <meshStandardMaterial color="#fff" />
        </mesh>
        <mesh position={[0, 0, 0.06]} rotation={[0, 0, -time * 0.05]}>
          <boxGeometry args={[0.04, 0.25, 0.02]} />
          <meshStandardMaterial color="#111" />
        </mesh>
        <mesh position={[0, 0, 0.07]} rotation={[0, 0, -time * 0.6]}>
          <boxGeometry args={[0.03, 0.3, 0.02]} />
          <meshStandardMaterial color="#e63946" />
        </mesh>
      </group>

      {/* ceiling fans (two, for the bigger room) */}
      {[
        { x: 0, z: 1, off: 0 },
        { x: 0, z: 7, off: 2.1 },
      ].map((f, fi) => (
        <group key={fi} position={[f.x, 4.3, f.z]}>
          <mesh position={[0, -0.3, 0]}>
            <cylinderGeometry args={[0.05, 0.05, 0.6, 8]} />
            <meshStandardMaterial color="#333" />
          </mesh>
          <group position={[0, -0.62, 0]} rotation={[0, time * 7 + f.off, 0]}>
            {[0, 1, 2].map((i) => (
              <mesh key={i} position={[Math.cos((i * 2 * Math.PI) / 3) * 0.85, 0, Math.sin((i * 2 * Math.PI) / 3) * 0.85]} rotation={[0, -(i * 2 * Math.PI) / 3, 0]}>
                <boxGeometry args={[1.5, 0.04, 0.28]} />
                <meshStandardMaterial color="#6c4a2a" />
              </mesh>
            ))}
          </group>
        </group>
      ))}

      {/* old TV */}
      <group position={[-6.5, 2.6, 10.6]} rotation={[0, Math.PI, 0]}>
        <mesh>
          <boxGeometry args={[1.6, 1.1, 0.5]} />
          <meshStandardMaterial color="#3a3a3a" />
        </mesh>
        <mesh position={[0, 0, 0.26]}>
          <planeGeometry args={[1.3, 0.85]} />
          <meshStandardMaterial color={`hsl(${(time * 40) % 360},70%,55%)`} emissive={`hsl(${(time * 40) % 360},70%,40%)`} emissiveIntensity={0.9} />
        </mesh>
        <Html position={[0, -0.9, 0.3]} center distanceFactor={10}>
          <div style={{ color: "#fff", fontSize: 11, background: "#00000099", padding: "2px 8px", borderRadius: 8 }}>
            📺 Retro hits only
          </div>
        </Html>
      </group>

      {/* hair dryer + cabinet right wall */}
      <group position={[11.9, 0, -1]}>
        <mesh position={[0, 0.5, 0]}>
          <boxGeometry args={[0.6, 1.0, 1.6]} />
          <meshStandardMaterial color="#99582a" />
        </mesh>
        <mesh position={[-0.2, 1.2, 0.3]}>
          <boxGeometry args={[0.25, 0.18, 0.4]} />
          <meshStandardMaterial color="#e63946" />
        </mesh>
      </group>

      {/* hair dryer + cabinet right wall */}
      <group position={[11.9, 0, -1]}>
        <mesh position={[0, 0.5, 0]}>
          <boxGeometry args={[0.6, 1.0, 1.6]} />
          <meshStandardMaterial color="#99582a" />
        </mesh>
        <mesh position={[-0.2, 1.2, 0.3]}>
          <boxGeometry args={[0.25, 0.18, 0.4]} />
          <meshStandardMaterial color="#e63946" />
        </mesh>
      </group>

      {/* ============ CLUB BOLLYWOOD (second room, x ≈ 40) ============ */}
      {/* floor + walls */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[40, 0, 1]}>
        <planeGeometry args={[24, 18]} />
        <meshStandardMaterial color="#14101f" />
      </mesh>
      <mesh position={[40, 2.2, -8]}>
        <boxGeometry args={[24, 4.4, 0.3]} />
        <meshStandardMaterial color="#1c1030" />
      </mesh>
      <mesh position={[40, 2.2, 10]}>
        <boxGeometry args={[24, 4.4, 0.3]} />
        <meshStandardMaterial color="#1c1030" />
      </mesh>
      <mesh position={[28, 2.2, 1]}>
        <boxGeometry args={[0.3, 4.4, 18.5]} />
        <meshStandardMaterial color="#1c1030" />
      </mesh>
      <mesh position={[52, 2.2, 1]}>
        <boxGeometry args={[0.3, 4.4, 18.5]} />
        <meshStandardMaterial color="#1c1030" />
      </mesh>
      {/* neon sign */}
      <mesh position={[40, 3.1, -7.8]}>
        <planeGeometry args={[7, 1.5]} />
        <meshStandardMaterial map={clubNeonTex} emissive="#ffffff" emissiveMap={clubNeonTex} emissiveIntensity={1.4} />
      </mesh>
      {/* dance floor tiles */}
      {Array.from({ length: 36 }, (_, i) => {
        const gx = (i % 6) - 2.5;
        const gz = Math.floor(i / 6) - 2.5;
        const hue = (time * 90 + i * 28) % 360;
        return (
          <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[40 + gx * 1.25, 0.02, 1 + gz * 1.25]}>
            <planeGeometry args={[1.15, 1.15]} />
            <meshStandardMaterial color={`hsl(${hue},90%,55%)`} emissive={`hsl(${hue},90%,45%)`} emissiveIntensity={0.9} />
          </mesh>
        );
      })}
      {/* disco ball */}
      <mesh position={[40, 4.0, 1]}>
        <cylinderGeometry args={[0.04, 0.04, 0.8, 8]} />
        <meshStandardMaterial color="#333" />
      </mesh>
      <mesh position={[40, 3.4, 1]} rotation={[0, time * 0.8, 0]}>
        <sphereGeometry args={[0.55, 16, 12]} />
        <meshStandardMaterial color="#dfe9ff" metalness={1} roughness={0.08} />
      </mesh>
      {/* roaming party spotlights */}
      {[0, 1, 2].map((i) => (
        <pointLight
          key={i}
          position={[40 + Math.cos(time * 1.4 + (i * 2 * Math.PI) / 3) * 5, 3.4, 1 + Math.sin(time * 1.4 + (i * 2 * Math.PI) / 3) * 5]}
          intensity={30}
          distance={16}
          color={`hsl(${(time * 60 + i * 120) % 360},100%,60%)`}
        />
      ))}
      {/* lasers */}
      {[0, 1, 2, 3].map((i) => (
        <mesh
          key={i}
          position={[40, 3.9, 1]}
          rotation={[Math.PI / 2.4, 0, time * 1.1 + (i * Math.PI) / 2]}
        >
          <boxGeometry args={[0.05, 7, 0.05]} />
          <meshStandardMaterial
            color={["#ff2fb3", "#00e5ff", "#a3ff12", "#ffea00"][i]}
            emissive={["#ff2fb3", "#00e5ff", "#a3ff12", "#ffea00"][i]}
            emissiveIntensity={2}
            transparent
            opacity={0.75}
          />
        </mesh>
      ))}
      {/* DJ booth */}
      <group position={[40, 0, -6.5]}>
        <mesh position={[0, 0.55, 0]}>
          <boxGeometry args={[3.4, 1.1, 1.1]} />
          <meshStandardMaterial color="#0d0d1a" />
        </mesh>
        <mesh position={[0, 1.14, 0]}>
          <boxGeometry args={[3.5, 0.08, 1.2]} />
          <meshStandardMaterial color="#7b2ff7" emissive="#7b2ff7" emissiveIntensity={0.7} />
        </mesh>
        <mesh position={[-0.6, 1.35, 0]} rotation={[0, 0, 0.2]}>
          <cylinderGeometry args={[0.22, 0.22, 0.06, 16]} />
          <meshStandardMaterial color="#111" />
        </mesh>
        <mesh position={[0.6, 1.35, 0]} rotation={[0, 0, -0.2]}>
          <cylinderGeometry args={[0.22, 0.22, 0.06, 16]} />
          <meshStandardMaterial color="#111" />
        </mesh>
        <mesh position={[0, 2.2, -0.3]}>
          <planeGeometry args={[2.6, 0.6]} />
          <meshStandardMaterial map={discoTex} emissive="#ffffff" emissiveMap={discoTex} emissiveIntensity={0.9} />
        </mesh>
      </group>
      {/* speakers */}
      {[
        { x: 36, z: 6 },
        { x: 44, z: 6 },
      ].map((sp, i) => (
        <group key={i} position={[sp.x, 0, sp.z]}>
          <mesh position={[0, 0.8, 0]}>
            <boxGeometry args={[1.1, 1.6, 1]} />
            <meshStandardMaterial color="#0d0d1a" />
          </mesh>
          <mesh position={[0, 1.1 + Math.sin(time * 8 + i) * 0.03, -0.51]} rotation={[0, Math.PI, 0]}>
            <circleGeometry args={[0.32, 16]} />
            <meshStandardMaterial color="#111" emissive="#ff2fb3" emissiveIntensity={1.2} />
          </mesh>
        </group>
      ))}
      {/* juice bar */}
      <group position={[50.5, 0, 2]}>
        <mesh position={[0, 0.55, 0]}>
          <boxGeometry args={[1.2, 1.1, 5]} />
          <meshStandardMaterial color="#5a189a" />
        </mesh>
        <mesh position={[0, 1.14, 0]}>
          <boxGeometry args={[1.4, 0.08, 5.2]} />
          <meshStandardMaterial color="#9d4edd" emissive="#9d4edd" emissiveIntensity={0.4} />
        </mesh>
        {[-1.5, -0.5, 0.5, 1.5].map((z, i) => (
          <mesh key={i} position={[-0.2, 1.32, z]}>
            <cylinderGeometry args={[0.06, 0.045, 0.16, 10]} />
            <meshStandardMaterial color={["#ff9f1c", "#ff2fb3", "#00e5ff", "#a3ff12"][i]} emissive={["#ff9f1c", "#ff2fb3", "#00e5ff", "#a3ff12"][i]} emissiveIntensity={0.8} />
          </mesh>
        ))}
      </group>
      {/* return door to salon (left wall) */}
      <group position={[28.28, 0, 6]}>
        <mesh position={[0.35, 1.5, -1.2]}>
          <boxGeometry args={[0.7, 3.2, 0.35]} />
          <meshStandardMaterial color="#ffb703" emissive="#ffb703" emissiveIntensity={0.25} />
        </mesh>
        <mesh position={[0.35, 1.5, 1.2]}>
          <boxGeometry args={[0.7, 3.2, 0.35]} />
          <meshStandardMaterial color="#ffb703" emissive="#ffb703" emissiveIntensity={0.25} />
        </mesh>
        <mesh position={[0.35, 3.15, 0]}>
          <boxGeometry args={[0.7, 0.35, 2.75]} />
          <meshStandardMaterial color="#ffb703" emissive="#ffb703" emissiveIntensity={0.25} />
        </mesh>
        <mesh position={[0.1, 1.45, 0]} rotation={[0, Math.PI / 2, 0]}>
          <circleGeometry args={[1.05 + 0.06 * Math.sin(time * 4), 28]} />
          <meshStandardMaterial color="#2a1a08" emissive="#ffb703" emissiveIntensity={1.1} transparent opacity={0.92} />
        </mesh>
        <mesh position={[0.1, 3.35, 0]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[2.2, 0.7]} />
          <meshStandardMaterial map={salonBackTex} emissive="#ffffff" emissiveMap={salonBackTex} emissiveIntensity={0.9} />
        </mesh>
        <mesh position={[0.9, 0.02, 0]}>
          <boxGeometry args={[1.6, 0.04, 2.0]} />
          <meshStandardMaterial color="#9d0208" />
        </mesh>
        <Html position={[0.6, 4.1 + 0.12 * Math.sin(time * 2.5), 0]} center distanceFactor={12}>
          <div style={{ fontSize: 26 }}>💈</div>
        </Html>
      </group>
    </group>
  );
}

// ---------- barbers ----------
function Barbers({ chairs, dialogues, time }: { chairs: ChairInfo[]; dialogues: Record<number, string>; time: number }) {
  return (
    <group>
      {CHAIR_POS.map((p, i) => {
        const c = chairs[i];
        const cutting = c?.state === "CUTTING";
        return (
          <group key={i} position={[p.x, 0, p.z + 1.25]} rotation={[0, Math.PI, 0]}>
            <Humanoid avatarId="generic" barber cutting={cutting} time={time + i} />
            {dialogues[i] && (
              <Html position={[0, 2.4, 0]} center distanceFactor={9}>
                <div className="dialogue-bubble">💈 {dialogues[i]}</div>
              </Html>
            )}
            <Html position={[0, 0.1, 0]} center distanceFactor={12}>
              <div
                style={{
                  fontSize: 10,
                  padding: "1px 7px",
                  borderRadius: 8,
                  background: cutting ? "#e63946" : c?.state === "AVAILABLE" ? "#2a9d8f" : "#ffb703",
                  color: cutting || c?.state === "AVAILABLE" ? "#fff" : "#231303",
                  fontWeight: 700,
                }}
              >
                {c?.state ?? "…"}
              </div>
            </Html>
          </group>
        );
      })}
    </group>
  );
}

// ---------- player rigs ----------
function RemoteRig({ p, agent, time }: { p: RemotePlayer; agent: AgentInfo | undefined; time: number }) {
  const clubbed = isClubX(p.x);
  const dancing = p.emote === "dance" || clubbed; // everyone dances in the club
  const waving = p.emote === "wave";
  const seated = p.activity === "GETTING_HAIRCUT" || p.activity === "SITTING";
  const moving = p.activity === "WALKING";
  return (
    <group position={[p.x, 0, p.z]} rotation={[0, p.rotY, 0]}>
      <AvatarRig avatarId={p.avatarId} moving={moving} sitting={seated} dancing={dancing} waving={waving} emote={p.emote} time={time} />
      <Html position={[0, 2.35, 0]} center distanceFactor={10}>
        <div style={{ textAlign: "center" }}>
          <div style={{ background: "#000000aa", color: "#fff", fontSize: 11, padding: "2px 8px", borderRadius: 8, whiteSpace: "nowrap" }}>
            {p.name} {p.emote === "laugh" ? "😂" : p.emote === "wave" ? "👋" : p.emote === "dance" ? "💃" : p.emote === "thumbs" ? "👍" : ""}
          </div>
          {agent && (
            <div style={{ background: "#1d3557ee", color: "#fff", fontSize: 10, padding: "2px 8px", borderRadius: 8, marginTop: 2, whiteSpace: "nowrap", border: "1px solid #4cc9f055" }}>
              {providerIcon(agent.provider)} {agent.provider} {Math.round(agent.progress)}%
              <div style={{ background: "#ffffff2a", borderRadius: 4, height: 4, marginTop: 2 }}>
                <div style={{ width: `${agent.progress}%`, height: "100%", borderRadius: 4, background: "#4cc9f0" }} />
              </div>
            </div>
          )}
          {(p.activity === "WAITING" || p.activity === "GETTING_HAIRCUT") && (
            <div style={{ background: "#ffb703", color: "#231303", fontSize: 10, padding: "1px 6px", borderRadius: 6, marginTop: 2, fontWeight: 700 }}>
              {p.activity === "WAITING" ? "in queue" : "💈 cutting…"}
            </div>
          )}
        </div>
      </Html>
    </group>
  );
}

// ---------- main scene ----------
export interface InteractTarget {
  kind: "reception" | "chair" | "sofa" | "portal" | null;
  chairId?: number;
  to?: "club" | "salon";
  label?: string;
}

export function SalonScene({
  myId,
  myAvatar,
  myName,
  remotes,
  chairs,
  dialogues,
  myPos,
  myRot,
  seatedChair,
  sofaSeated,
  onMove,
  agents,
}: {
  myId: string;
  myAvatar: string;
  myName: string;
  remotes: Record<string, RemotePlayer>;
  chairs: ChairInfo[];
  dialogues: Record<number, string>;
  myPos: React.MutableRefObject<{ x: number; z: number }>;
  myRot: React.MutableRefObject<number>;
  seatedChair: number | null;
  sofaSeated: boolean;
  onMove: (x: number, z: number, rotY: number, walking: boolean) => void;
  interactRef: React.MutableRefObject<InteractTarget>;
  agents: Record<string, AgentInfo>;
}) {
  const [time, setTime] = useState(0);
  return (
    <Canvas shadows={false} dpr={[1, 1.5]} camera={{ fov: 55, position: [0, 4, 11] }} gl={{ antialias: true }}>
      <color attach="background" args={["#1a120b"]} />
      <ambientLight intensity={0.75} />
      <directionalLight position={[4, 7, 5]} intensity={1.1} />
      <pointLight position={[0, 3.8, 1]} intensity={25} distance={22} color="#ffd9a0" />
      <pointLight position={[0, 3.8, 7.5]} intensity={16} distance={18} color="#ffd9a0" />
      <pointLight position={[0, 2.5, -6]} intensity={10} distance={14} color="#fff1d6" />
      <Tick setTime={setTime} />
      <Environment time={time} />
      <Barbers chairs={chairs} dialogues={dialogues} time={time} />
      <LocalPlayer
        myId={myId}
        myAvatar={myAvatar}
        myName={myName}
        myPos={myPos}
        myRot={myRot}
        seatedChair={seatedChair}
        sofaSeated={sofaSeated}
        onMove={onMove}
        time={time}
      />
      {Object.values(remotes).map((p) => (
        <RemoteRig key={p.id} p={p} agent={agents[p.id]} time={time} />
      ))}
      <CameraRig myPos={myPos} seatedChair={seatedChair} />
    </Canvas>
  );
}

function Tick({ setTime }: { setTime: (t: number) => void }) {
  useFrame((s) => setTime(s.clock.elapsedTime));
  return null;
}

const keys: Record<string, boolean> = {};
if (typeof window !== "undefined") {
  window.addEventListener("keydown", (e) => {
    keys[e.key.toLowerCase()] = true;
  });
  window.addEventListener("keyup", (e) => {
    keys[e.key.toLowerCase()] = false;
  });
}

function LocalPlayer({
  myAvatar,
  myName,
  myPos,
  myRot,
  seatedChair,
  sofaSeated,
  onMove,
  time,
}: {
  myId: string;
  myAvatar: string;
  myName: string;
  myPos: React.MutableRefObject<{ x: number; z: number }>;
  myRot: React.MutableRefObject<number>;
  seatedChair: number | null;
  sofaSeated: boolean;
  onMove: (x: number, z: number, rotY: number, walking: boolean) => void;
  time: number;
}) {
  const ref = useRef<THREE.Group>(null);
  const lastEmit = useRef(0);
  const lastStep = useRef(0);
  const { gl } = useThree();
  const yaw = useRef(Math.PI);
  const pitch = useRef(0.35);
  const dragging = useRef(false);
  const px = useRef(0);
  const py = useRef(0);

  useEffect(() => {
    const el = gl.domElement;
    const down = (e: PointerEvent) => {
      dragging.current = true;
      px.current = e.clientX;
      py.current = e.clientY;
    };
    const up = () => (dragging.current = false);
    const move = (e: PointerEvent) => {
      if (!dragging.current) return;
      yaw.current -= (e.clientX - px.current) * 0.005;
      pitch.current = THREE.MathUtils.clamp(pitch.current + (e.clientY - py.current) * 0.003, 0.05, 1.1);
      px.current = e.clientX;
      py.current = e.clientY;
    };
    const wheel = (e: WheelEvent) => {
      (CameraRig as any).dist = THREE.MathUtils.clamp(((CameraRig as any).dist ?? 5.5) + e.deltaY * 0.005, 3, 9);
    };
    el.addEventListener("pointerdown", down);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointermove", move);
    el.addEventListener("wheel", wheel);
    (LocalPlayer as any).yaw = yaw;
    return () => {
      el.removeEventListener("pointerdown", down);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointermove", move);
      el.removeEventListener("wheel", wheel);
    };
  }, [gl]);

  useFrame((s, delta) => {
    (LocalPlayer as any).yaw = yaw;
    if (seatedChair !== null || sofaSeated) {
      // snap to seat
      if (seatedChair !== null) {
        const c = CHAIR_POS[seatedChair];
        myPos.current.x = c.x;
        myPos.current.z = c.z;
        myRot.current = Math.PI;
      } else {
        myPos.current.x = SOFA_POS.x;
        myPos.current.z = SOFA_POS.z - 0.05;
        myRot.current = Math.PI; // sofa faces the barbers now
      }
      if (ref.current) {
        ref.current.position.set(myPos.current.x, 0, myPos.current.z);
        ref.current.rotation.set(0, myRot.current, 0);
      }
      if (s.clock.elapsedTime - lastEmit.current > 0.5) {
        lastEmit.current = s.clock.elapsedTime;
        onMove(myPos.current.x, myPos.current.z, myRot.current, false);
      }
      return;
    }
    const dt = Math.min(delta, 0.05);
    const speed = keys["shift"] ? 6.2 : 4.4;
    let fx = 0;
    let fz = 0;
    // camera-relative
    const sin = Math.sin(yaw.current);
    const cos = Math.cos(yaw.current);
    if (keys["w"]) {
      fx -= sin;
      fz -= cos;
    }
    if (keys["s"]) {
      fx += sin;
      fz += cos;
    }
    if (keys["a"]) {
      fx -= cos;
      fz += sin;
    }
    if (keys["d"]) {
      fx += cos;
      fz -= sin;
    }
    const walking = fx !== 0 || fz !== 0;
    if (walking) {
      const len = Math.hypot(fx, fz);
      fx = (fx / len) * speed * dt;
      fz = (fz / len) * speed * dt;
      const res = collide(myPos.current.x + fx, myPos.current.z + fz);
      myPos.current.x = res.x;
      myPos.current.z = res.z;
      myRot.current = Math.atan2(fx, fz);
      if (s.clock.elapsedTime - lastStep.current > 0.34) {
        lastStep.current = s.clock.elapsedTime;
        salonAudio.step_();
      }
    }
    if (ref.current) {
      ref.current.position.set(myPos.current.x, walking ? Math.abs(Math.sin(s.clock.elapsedTime * 10)) * 0.05 : 0, myPos.current.z);
      ref.current.rotation.set(0, myRot.current, 0);
    }
    if (walking || s.clock.elapsedTime - lastEmit.current > 0.5) {
      if (s.clock.elapsedTime - lastEmit.current > 0.066 || walking) {
        lastEmit.current = s.clock.elapsedTime;
        onMove(myPos.current.x, myPos.current.z, myRot.current, walking);
      }
    }
  });

  return (
    <group ref={ref} position={[myPos.current.x, 0, myPos.current.z]}>
      <AvatarRig
        avatarId={myAvatar}
        moving={!seatedChair && !sofaSeated && !!(keys["w"] || keys["a"] || keys["s"] || keys["d"])}
        sitting={seatedChair !== null || sofaSeated}
        dancing={isClubX(myPos.current.x)}
        waving={false}
        emote={null}
        time={time}
      />
      <Html position={[0, 2.4, 0]} center distanceFactor={10}>
        <div style={{ background: "#ffb703", color: "#231303", fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 8, whiteSpace: "nowrap" }}>
          {myName} (You)
        </div>
      </Html>
    </group>
  );
}

function CameraRig({ myPos, seatedChair }: { myPos: React.MutableRefObject<{ x: number; z: number }>; seatedChair: number | null }) {
  useFrame(({ camera }) => {
    if (seatedChair !== null) {
      // cutting camera: park front-side of the chair so you SEE the barber work
      const c = CHAIR_POS[seatedChair];
      camera.position.lerp(new THREE.Vector3(c.x + 2.1, 2.4, c.z + 3.4), 0.07);
      camera.lookAt(c.x - 0.3, 1.2, c.z + 0.4);
      return;
    }
    const yawObj = (LocalPlayer as any).yaw as React.MutableRefObject<number> | undefined;
    const yaw = yawObj?.current ?? Math.PI;
    const dist = (CameraRig as any).dist ?? 5.5;
    const tx = myPos.current.x + Math.sin(yaw) * dist;
    const tz = myPos.current.z + Math.cos(yaw) * dist;
    const ty = 3.1;
    camera.position.lerp(new THREE.Vector3(tx, ty, tz), 0.12);
    // keep the camera inside whichever room you're in
    if (isClubX(myPos.current.x)) {
      camera.position.x = THREE.MathUtils.clamp(camera.position.x, CLUB_BOUNDS.minX, CLUB_BOUNDS.maxX);
      camera.position.z = THREE.MathUtils.clamp(camera.position.z, CLUB_BOUNDS.minZ, CLUB_BOUNDS.maxZ);
    } else {
      camera.position.x = THREE.MathUtils.clamp(camera.position.x, -12.1, 12.1);
      camera.position.z = THREE.MathUtils.clamp(camera.position.z, -8.6, 10.6);
    }
    camera.position.y = THREE.MathUtils.clamp(camera.position.y, 1.1, 4.3);
    camera.lookAt(myPos.current.x, 1.3, myPos.current.z - 0.5);
  });
  return null;
}

