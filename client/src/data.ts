export interface AvatarDef {
  id: string;
  label: string;
  skin: string;
  shirt: string;
  pants: string;
  hair: string;
  hairStyle: "flat" | "spiky" | "messy" | "bald" | "long" | "cap";
  glasses: boolean;
  beard: boolean;
  coolShade: boolean;
}

export const AVATARS: AvatarDef[] = [
  { id: "glasses", label: "Developer with Glasses", skin: "#c68642", shirt: "#2d6a4f", pants: "#1d3557", hair: "#1a1a1a", hairStyle: "flat", glasses: true, beard: false, coolShade: false },
  { id: "casual", label: "Casual Indian Guy", skin: "#a9713f", shirt: "#e76f51", pants: "#264653", hair: "#141414", hairStyle: "messy", glasses: false, beard: false, coolShade: false },
  { id: "bearded", label: "Bearded Developer", skin: "#8d5524", shirt: "#343a40", pants: "#212529", hair: "#0d0d0d", hairStyle: "flat", glasses: false, beard: true, coolShade: false },
  { id: "cool", label: "Cool Developer", skin: "#c68642", shirt: "#9d4edd", pants: "#10002b", hair: "#222222", hairStyle: "spiky", glasses: false, beard: false, coolShade: true },
  { id: "nerd", label: "Nerd", skin: "#e0ac69", shirt: "#4cc9f0", pants: "#3a0ca3", hair: "#3b2f2f", hairStyle: "messy", glasses: true, beard: false, coolShade: false },
  { id: "bald", label: "Bald Character", skin: "#a9713f", shirt: "#ffb703", pants: "#023047", hair: "#000000", hairStyle: "bald", glasses: false, beard: true, coolShade: false },
  { id: "female", label: "Female Developer", skin: "#c68642", shirt: "#ff5d8f", pants: "#1d3557", hair: "#191919", hairStyle: "long", glasses: false, beard: false, coolShade: false },
  { id: "generic", label: "Generic Avatar", skin: "#b07d4f", shirt: "#6c757d", pants: "#343a40", hair: "#242424", hairStyle: "flat", glasses: false, beard: false, coolShade: false },
  { id: "robot", label: "Salon Robot 🤖", skin: "#9aa5b1", shirt: "#00b4d8", pants: "#3a506b", hair: "#222222", hairStyle: "cap", glasses: false, beard: false, coolShade: true },
];

export function avatarById(id: string): AvatarDef {
  return AVATARS.find((a) => a.id === id) ?? AVATARS[7];
}

/** Body tint applied to the free Xbot 3D model per avatar (model has no separate clothes). */
export function avatarTint(id: string): string {
  return avatarById(id).shirt;
}

export interface HaircutDef {
  id: string;
  name: string;
  hindi: string;
  displayTime: string;
  realSeconds: number;
  price: string;
  emoji: string;
}

export const HAIRCUTS: HaircutDef[] = [
  { id: "normal", name: "Normal Cut", hindi: "Simple, sobar, kaam ho gaya", displayTime: "3 min", realSeconds: 30, price: "₹150", emoji: "✂️" },
  { id: "fade", name: "Fade", hindi: "Side se zero, upar se hero", displayTime: "5 min", realSeconds: 45, price: "₹250", emoji: "🔥" },
  { id: "hair-beard", name: "Hair + Beard", hindi: "Full jugaad package", displayTime: "7 min", realSeconds: 60, price: "₹350", emoji: "🧔" },
  { id: "massage", name: "Head Massage", hindi: "Champi with extra tel", displayTime: "8 min", realSeconds: 60, price: "₹300", emoji: "💆" },
  { id: "bhaiya", name: "Whatever Bhaiya Decides", hindi: "Bharosa rakho", displayTime: "5 min", realSeconds: 45, price: "₹200", emoji: "🎲" },
];

export const BARBER_LINES = [
  "Kya haircut karna hai boss?",
  "Side thoda chhota?",
  "Machine lagau?",
  "Beard bhi kar du?",
  "Bhaiya normal hi rakhna?",
  "Ho gaya boss.",
  "Mirror mein dekh lo.",
  "Aur thoda trim kar du?",
];

export const EMOTES = [
  { id: "laugh", emoji: "😂", label: "Laugh" },
  { id: "wave", emoji: "👋", label: "Wave" },
  { id: "dance", emoji: "💃", label: "Dance" },
  { id: "thumbs", emoji: "👍", label: "Thumbs up" },
];

export function providerIcon(provider: string): string {
  const p = (provider || "").toLowerCase();
  if (p.includes("chatgpt") || p.includes("openai")) return "✨";
  if (p.includes("antigravity")) return "🛰️";
  if (p.includes("claude")) return "🟠";
  if (p.includes("cursor")) return "◤";
  if (p.includes("copilot")) return "🐙";
  if (p.includes("gemini")) return "💫";
  if (p.includes("sim")) return "🤖";
  return "🧠";
}

export function formatWait(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
