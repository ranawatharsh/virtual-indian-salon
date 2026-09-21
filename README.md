# 💈 Virtual Indian Salon — "While AI Works, Get a Haircut"

A browser-based **multiplayer 3D virtual Indian salon for developers**.
Your AI agent grinds in the background while you walk around a nostalgic
Indian barber shop, join the queue, chat with other devs, and get a virtual haircut.

> **Your AI is busy. You don't have to be.**

## The loop

```
LANDING → CHOOSE AVATAR → ENTER SALON → SEE REAL PLAYERS → WALK AROUND
→ JOIN QUEUE → WAIT → 🔔 YOUR TURN → SIT IN CHAIR → PICK HAIRCUT
→ BARBER CUTS (dialogue + SFX) → FINISH → SOCIALIZE
```

## Quick start (local)

Requirements: **Node 20+**, npm.

```bash
# 1) start the multiplayer server (:3001)
cd server
npm install
npm run dev

# 2) in a second terminal, start the client (:5173)
cd client
npm install
npm run dev
```

Open http://localhost:5173, pick an avatar + name, click **Enter Salon**.
Open a second tab/window with a different name to see real multiplayer.

### Test multiplayer headlessly (no browser needed)

```bash
cd server
npm run dev            # terminal 1
npx tsx src/test-multi.ts   # terminal 2 — movement, queue, chairs, chat, disconnect
npx tsx src/test-chair.ts   # chair lifecycle + double-book guard + agent webhook
```

## Controls

| Key | Action |
|---|---|
| `W A S D` | Move (camera-relative) |
| Mouse drag | Look / orbit camera, wheel = zoom |
| `E` | Interact (join queue at reception, sit in your chair, pick haircut, sit on sofa, stand up) |
| `Enter` (in chat box) | Send chat |
| `ESC` | Menu (back / leave salon) |

## Features

- **Landing page** — "WHILE AI WORKS. GET A HAIRCUT. 💈" + live online count
- **9 avatars** — glasses dev, casual guy, bearded dev, cool dev, nerd, bald, female dev, generic + **Salon Robot 🤖**
- **Real animated 3D models (free, vendored offline)** — Detroit: Become Human faces
  (Kara → female, Elijah → cool, Todd → bearded: textured, Mixamo-rigged, idle clip +
  procedural bone-walk when no walk clip ships), Xbot mocap humanoid for the rest,
  RobotExpressive (CC-BY) for the robot. **Uniform stature**: every rig is scaled by
  its head bone to the same eye level, so no avatar looks small/big vs the scene.
  Seated customers show their ACTUAL model lowered under a big barber cape, head out.
  ⚠️ The Detroit files look like third-party game rips: fine for local play, replace
  with verified CC0/CC-BY models before any public hosting (see `public/models/LICENSES.txt`).
  Note: the 3 model files are ~45 MB on disk but lazy-load per avatar, never upfront.
- **Proper walk cycle** — mocap clips where present, hip/shoulder-pivot procedural
  otherwise (including bone-driven stride on idle-only rips), counter-swinging arms,
  stride bob, forward lean, smooth start/stop blending, idle breathing
- **Real mirrors** — planar reflections behind every chair: watch yourself actually get the haircut
- **Club dance moves** — mocap `Dance` where files have it, else a 5-move bone-driven
  routine (Bounce, Sway, Twist, Snap, Groove): auto-cycles in the club, or press
  **1–5** anywhere to hit a specific move (WASD stops). Moves sync to other players.
- **Full 3D Indian salon (bigger room)** — 5 barber chairs (mirrors, stations, torans),
  flipped waiting sofa **facing the barbers**, coffee table with cutting chai, reception,
  wall clock, 2 ceiling fans, tube lights, old TV, product shelves, backwash unit,
  barber pole, rug, calendar / SHUBH LABH / WELCOME dressing, NO CREDIT boards
- **🪩 CLUB BOLLYWOOD next door** — glowing disco door on the salon's right wall.
  Walk up + E: neon room, disco ball, roaming spotlights, lasers, LED dance floor,
  DJ booth, juice bar. Everybody auto-dances inside (you too), the radio flips to
  double-tempo party mode with bass — and when **your chair is ready you're beamed
  straight back** to the salon. Wait out your queue on the dance floor.
- **Multiplayer (server-authoritative)** — position/rotation/avatar/name/activity/queue/haircut
  synced over WebSockets; ~20–50 players per room
- **Queue** — server-owned FIFO, live positions + per-position ETA, auto-call (`🔔 YOUR TURN! Chair #n`)
- **Chairs** — `AVAILABLE → OCCUPIED → CUTTING → FINISHED → AVAILABLE`, double-booking impossible
- **5 haircuts** — Normal / Fade / Hair+Beard / Head Massage / Bhaiya Decides
  (displayed as 3–8 min, actually 30–60 s for MVP)
- **Barber NPCs** — idle sway, cutting arm animation, trimmer prop, status badges, dialogue bubbles
  ("Kya haircut karna hai boss?", "Machine lagau?", "Ho gaya boss.", …)
- **Audio (procedural, no files, no copyrighted music)** — fan hum, retro-inspired pluck + drone loop,
  clipper buzz, scissor snips, turn bell, footsteps; `🎵 Music` / `🔊 SFX` toggles
- **Salon Jukebox 🎧** — 3 engines: 📻 royalty-free Retro Salon Radio (default),
  📁 **My Files** (play your own downloaded Bollywood classics — files stay in your browser, never uploaded),
  🟢 **Spotify Connect** (salon tab becomes a speaker; needs free dev Client ID + Spotify Premium).
  > Copyright note: never commit downloaded Bollywood MP3s to the repo or ship them —
  > My Files plays each user's local collection privately, which keeps it legit.
- **AI agent panel** — simulated task + progress + ETA, `COMPLETED` celebration;
  designed for real integrations via webhook (below)
- **Chat + emotes** — proximity-global text chat, system messages, 😂👋💃👍 emotes with avatar indicators
- **Waiting area** — sofa to sit on, TV, magazines, music, other players
- **Error handling** — "barber's Wi-Fi died. Reconnecting…", full-room message, safe reconnect

## Are the AI agents real?

Honest answer: **by default they're simulated** — the server assigns a random
dev task ("Deploying to staging"…) and ticks progress until "Task complete".
That "task complete" you saw is the simulation finishing, not a real agent.

To make it **your real work**, two options (no extra setup beyond the salon):

**1. Wrap any command** (builds, tests, deploys — exit code drives the panel):

```bash
cd server
npm run agent -- --name Harsh --provider Antigravity --task "Refactoring auth" -- npm run build
# your salon name MUST match --name. Panel shows WORKING… → COMPLETED/FAILED for real.
# --provider can be ChatGPT, Antigravity, Claude Code, Cursor, Copilot, Gemini...
```

Everyone in the salon sees everyone else's agent live: provider icon + name +
progress bar floats over each player's head (try two tabs: `Harsh` + `Rahul`).
In-game: Agent panel → **🔌 Connect real agent** → pick provider → Copy command → run in `server/`.

## GitHub / publish checklist (do before going public)

```bash
git init (done) → create repo on github.com → 
git remote add origin https://github.com/YOU/virtual-indian-salon.git
git push -u origin master
```

⚠️ **Before pushing PUBLIC or deploying:** delete the Detroit `.glb` files from
`client/public/models/` (ripped game IP — DMCA risk) or keep the repo **private**.
The game falls back to Xbot automatically. Swap in verified CC0/CC-BY models first.
Deploy later: frontend `client/dist` → Vercel/Netlify, backend → Render/Railway/Fly
(`PORT` + `VITE_SERVER_URL`), or `docker compose up --build`.

**2. One-shot updates** from hooks/scripts/CI:

```bash
curl -X POST localhost:3001/api/agent/by-name/Harsh \
  -H 'Content-Type: application/json' \
  -d '{"status":"working","task":"Fixing flaky tests","progress":35}'
```

(`GET /api/players` lists who's online; the original `POST /api/agent/:playerId` webhook still works.)

## AI-agent webhook (future integration)

The server already accepts external agent updates:

```bash
POST /api/agent/:playerId
Content-Type: application/json

{ "status": "working", "task": "Refactoring authentication", "progress": 72, "etaSec": 200 }
```

The player's agent panel updates live. `GET /health`, `GET /api/online` for status.

## Custom characters from Sketchfab (free models)

The game auto-loads Sketchfab downloads — no code changes needed:

1. Open a model page (filtered to **Downloadable** + a **CC license**, e.g. CC-BY).
2. Click **Download 3D Model** → choose **glTF (.glb)** (tick "include animations" for animated characters).
3. Check the model's license on its page. **CC-BY models need credit** — add a line to
   `client/public/models/LICENSES.txt` (there's already an entry for RobotExpressive to copy).
4. Copy the `.glb` into `client/public/models/` named after the avatar:
   `avatar-glasses.glb`, `avatar-casual.glb`, `avatar-bearded.glb`, `avatar-cool.glb`,
   `avatar-nerd.glb`, `avatar-bald.glb`, `avatar-female.glb`, `avatar-generic.glb`
   (any subset — missing ones keep the built-in Xbot look).
5. Refresh the salon. Animations are matched by name (`walk…`, `idle…`, `dance…`, `wave…`),
   the model is auto-scaled to ~1.7 m with feet on the ground, textures preserved.

Notes / troubleshooting:
- I can't download from Sketchfab for you — downloads need your login. That's why it's drop-in.
- A model with no animations still works (stands in pose, name label on top).
- If a character walks backwards, its file faces −Z; re-export rotated 180° (or tell me and I'll add a per-model flip flag).
- Keep files smallish (<10 MB each) so the salon loads fast.
- Never commit copyrighted/paid models — stick to the Downloadable + CC filter you were using.

## Production build

## Deploy (Render, one click)

1. Push this repo to GitHub (see GitHub section above).
2. Render Dashboard → **New → Blueprint** → select the repo. `render.yaml` creates
   `salon-server` (Node + WebSockets) and `salon-client` (static), auto-wired via
   `VITE_SERVER_HOST`. Hit Apply — live in a few minutes on free plans.
3. First load after idle takes ~50s (free-plan sleep). Upgrade server to Starter
   ($7/mo) to kill the cold start when traffic comes.

Local production check (same commands Render runs):

```bash
npm run build --workspace=salon-server
npm run build --workspace=salon-client
npm start --workspace=salon-server
```

| Var | Where | Default | Purpose |
|---|---|---|---|
| `PORT` | server | `3001` | HTTP + WS port |
| `VITE_SERVER_URL` | client (build-time) | `http://<host>:3001` | where the game connects |
| `VITE_SPOTIFY_CLIENT_ID` | client (build-time, optional) | — | pre-fill Spotify app Client ID (or enter it in the Jukebox UI) |

### Spotify setup (2 min, free app + Premium needed for playback)

1. Open developer.spotify.com/dashboard → Create app
2. Settings → add this Redirect URI (shown in the Jukebox Spotify tab, e.g. `http://localhost:5173/`) → Save
3. Copy the Client ID → paste in the salon Jukebox → Connect Spotify → Start player
4. Pick songs from any Spotify app — audio comes out of the salon tab 🎧

Example: `VITE_SERVER_URL=https://salon-server.onrender.com npm run build`.

Or run both with Docker Compose:

```bash
docker compose up --build
```

## Project structure

```
.
├── client/           # React + TS + Vite + R3F/Three + socket.io-client
│   ├── public/models/    # vendored free GLBs (Xbot, RobotExpressive) + LICENSES.txt
│   └── src/
│       ├── components/   # landing, avatar select, HUD, queue, chat, agent, haircut menu, jukebox
│       ├── game/         # SalonScene: environment, avatars, GLB rigs, barbers, controls, camera
│       ├── multiplayer/  # socket singleton + shared types
│       ├── audio/        # procedural WebAudio engine (salon radio)
│       ├── music/        # local-file jukebox + Spotify PKCE/Playback SDK
│       └── App.tsx       # screens + socket wiring + queue/chair/chat state machine
├── server/           # Node + Express + socket.io (authoritative queue + chairs)
│   └── src/
│       ├── index.ts      # rooms, queue, chairs, chat, agents, webhook
│       ├── test-multi.ts # multiplayer sync tests
│       └── test-chair.ts # chair lifecycle + webhook tests
├── docker-compose.yml
└── README.md
```

## Verified

- `test-multi.ts`, `test-chair.ts`, `test-provider.ts` — all OK (re-run green)
- `test-club.ts` — spawn, queue-while-in-club → `yourTurn`, club wall clamp (200 → 51.6), salon return: **all OK**
- `client: tsc + vite build` — clean; `server: tsc` — clean
