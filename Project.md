# Project: Virtual Indian Salon — “While AI Works, Get a Haircut”

## 1. Product Vision

Build a browser-based multiplayer 3D virtual Indian salon for developers.

The core idea:

> **AI agents are working in the background. Instead of staring at progress bars, developers can enter a virtual Indian salon, join a queue, walk around, socialize with other developers, listen to music, and get a virtual haircut.**

This should feel like a small, polished multiplayer game rather than a productivity dashboard.

The experience should be fun, humorous, nostalgic, and distinctly Indian.

---

# 2. Core User Flow

### Landing Page

Show a stylish landing page with the tagline:

> **While AI Works. Get a Haircut. 💈**

Subheading:

> Your AI is busy. You don't have to be.

Primary button:

> **ENTER SALON**

Secondary information:

* Players currently online
* Short explanation of the concept
* “Your AI works. You chill.”

Clicking ENTER SALON opens the 3D salon.

---

# 3. Avatar Selection

Before entering, allow the player to choose an avatar.

Initially provide around 5–8 simple stylized characters.

Examples:

* Developer with glasses
* Casual Indian guy
* Bearded developer
* Cool developer
* Nerd
* Bald character
* Female developer
* Generic avatar

Allow the user to enter a display name.

Example:

> Name: Harsh

Then:

> **Enter Salon**

The selected avatar and name should be visible to other players.

---

# 4. 3D Indian Salon

Create a complete small Indian neighbourhood barber/salon environment.

Do NOT make it look like a generic futuristic Western salon.

The environment should feel like a nostalgic Indian local salon.

Include:

* 5 barber chairs
* Large mirrors
* Barber stations
* Waiting sofa
* Reception/counter
* Wall clock
* Ceiling fan
* Old television
* Product shelves
* Hair products
* Combs
* Spray bottles
* Towels
* Newspaper/magazines
* Small plants
* Haircut posters
* Bollywood-style posters
* Retro decorations
* Price board
* Slightly old-school Indian interior
* Floor tiles
* Barber tools
* Hair dryers
* Storage cabinets

Add small humorous details such as:

> “NO CREDIT”

> “PLEASE WAIT FOR YOUR TURN”

> “TODAY'S SPECIAL: NORMAL CUT ₹150”

The environment should be stylized/low-poly enough to run smoothly in a browser.

---

# 5. Player Controls

Desktop browser controls:

### Movement

W = forward
S = backward
A = left
D = right

Mouse = camera/look

E = interact

ESC = menu

The player should be able to freely walk around the salon.

Add collision detection so players cannot walk through walls, chairs, counters, etc.

The camera should feel like a polished third-person/over-the-shoulder multiplayer game.

---

# 6. Multiplayer

This is a critical feature.

Multiple real users should be able to enter the same salon.

For example:

```text
47 DEVELOPERS ONLINE
```

If three other users are inside the salon, I should see their actual avatars moving around.

Synchronize:

* Player position
* Rotation
* Avatar
* Player name
* Current activity
* Queue position
* Haircut status

Use a proper multiplayer architecture rather than faking multiplayer locally.

Preferred approach:

* React
* TypeScript
* React Three Fiber / Three.js
* Node.js backend
* WebSocket-based multiplayer
* Colyseus or an equivalent reliable multiplayer framework

Use the simplest robust architecture that can support approximately 20–50 concurrent players in the initial version.

---

# 7. Queue System

The salon has 5 barber chairs.

Players can join the waiting queue.

Display a UI panel:

```text
💈 SALON QUEUE

Currently waiting: 4

1. Rahul
2. Akshay
3. Harsh ← You
4. Tanmay

Your position: #3

Estimated wait:
07:32
```

The queue should be server-authoritative.

Do NOT calculate queue state independently on each client.

When a player joins:

* Add them to queue
* Assign queue position
* Calculate approximate waiting time
* Update everyone in real time

When a chair becomes available:

* Next player is called
* Their avatar moves/enters the chair interaction
* Their status changes from WAITING → GETTING_HAIRCUT

---

# 8. Barber Chairs

Create 5 barber chairs.

Each chair can have:

```text
AVAILABLE
OCCUPIED
CUTTING
FINISHED
```

When a player reaches their turn:

Show:

> 🔔 **YOUR TURN!**

Then:

> Chair #3 is ready.

Player walks/interacts with the chair.

Character sits down.

Barber NPC begins haircut animation.

---

# 9. Haircut Selection

When the player gets their turn, show:

## What are we doing today, boss?

Options:

### Normal Cut

3 minutes

### Fade

5 minutes

### Hair + Beard

7 minutes

### Head Massage

8 minutes

### Whatever Bhaiya Decides

5 minutes

For the MVP, the actual durations can be compressed so users don't really have to wait several real minutes.

Example:

```text
Normal Cut → 30 seconds
Fade → 45 seconds
Hair + Beard → 60 seconds
Massage → 60 seconds
```

But display the experience as if it is a real salon.

---

# 10. Barber NPC

Create a barber NPC for each chair or a smaller number of barber NPCs.

The barber should have simple idle animations:

* Standing
* Looking around
* Cutting hair
* Using comb
* Using scissors
* Using electric trimmer
* Talking
* Cleaning

During haircut:

```text
Barber → comb
Barber → scissors
Barber → trimming
Barber → cleaning
```

Use animation states rather than requiring extremely complex character animation.

---

# 11. Indian Salon Dialogue

Add humorous Indian barber dialogue.

Examples:

> “Kya haircut karna hai boss?”

> “Side thoda chhota?”

> “Machine lagau?”

> “Beard bhi kar du?”

> “Bhaiya normal hi rakhna?”

> “Ho gaya boss.”

> “Mirror mein dekh lo.”

> “Aur thoda trim kar du?”

These can initially appear as text bubbles.

Do not require voice AI for the MVP.

---

# 12. Salon Audio

The environment should feel alive.

Add:

* Ceiling fan ambience
* Barber shop ambience
* Light environmental sounds
* Hair clipper sound
* Scissors
* Hair dryer
* Door sounds
* Footsteps
* NPC chatter

Also include retro Indian-style background music.

IMPORTANT:

Do not use copyrighted Bollywood songs in the production version unless properly licensed.

For the MVP use royalty-free/original retro-inspired Indian music.

Provide a music toggle:

```text
🎵 Music ON
🔊 SFX ON
```

---

# 13. Developer/AI Agent Panel

This is the unique feature of the product.

The player should have a small UI showing what their AI agent is doing.

Example:

```text
🤖 YOUR AI AGENT

Task:
Refactoring authentication

Status:
WORKING...

Progress:
██████████████░░ 82%

Estimated completion:
03:24
```

Initially this can be simulated.

Create a mock agent system with states:

```text
IDLE
WORKING
WAITING
COMPLETED
FAILED
```

Example:

```text
🤖 Agent working...

Analyzing code...
Running tests...
Fixing errors...
Deploying...
```

When the task completes:

```text
🎉 AGENT COMPLETE

Your AI finished the task.
```

The salon experience should continue independently of the agent.

---

# 14. Future AI Agent Integration

Architect the system so that later we can connect:

* OpenAI agents
* Claude Code
* Cursor
* GitHub Actions
* Custom webhooks
* Other coding agents

Eventually an external agent should be able to send something like:

```json
{
  "playerId": "abc123",
  "status": "working",
  "task": "Refactoring authentication",
  "progress": 72
}
```

The salon UI should update automatically.

Do NOT implement every integration now.

Just design the backend so this is possible later.

---

# 15. Social Interaction

Players should be able to see other users.

Add simple chat.

Example:

```text
Rahul:
bhai kitna wait hai?

Harsh:
3 mins 😂

Akshay:
mere agent ne production tod diya 💀
```

Keep chat simple.

Add:

* Text chat
* Player name labels
* Basic emotes

Potential emotes:

😂 Laugh

👋 Wave

💃 Dance

👍 Thumbs up

These are optional if time permits.

---

# 16. Waiting Area

Players who aren't getting a haircut should have something to do.

Create:

* Sofa
* TV
* Magazine/newspaper
* Small table
* Arcade-like object
* Music
* Other players

Players can sit or simply walk around.

The point is that waiting should feel like an actual social space.

---

# 17. UI Design

The UI should be minimal.

Do not cover the screen with dashboards.

Main HUD:

```text
┌────────────────────────────┐
│ 💈 INDIAN SALON             │
│                            │
│ Queue: #3                  │
│ Wait: 06:21                │
│                            │
│ 🤖 Agent: Working          │
│ ███████████░ 82%           │
└────────────────────────────┘
```

Bottom:

```text
WASD Move   |   E Interact   |   Enter Chat
```

The 3D environment should remain the primary focus.

---

# 18. Visual Style

Use a stylized 3D game aesthetic.

Target:

* Low-poly
* Warm
* Nostalgic
* Slightly humorous
* Indian
* Cozy
* Browser-friendly

Do NOT aim for photorealism.

Performance is more important than graphical complexity.

Target smooth performance on normal laptop/desktop browsers.

---

# 19. Technical Requirements

Recommended stack:

### Frontend

React
TypeScript
Vite
React Three Fiber
Three.js
@react-three/drei

### Multiplayer

Colyseus + WebSockets

### Backend

Node.js
TypeScript

### Database

PostgreSQL if persistence is required.

For MVP, only persist:

* Player profile/name
* Avatar selection
* Basic statistics

Do not over-engineer the database.

### Deployment

Frontend:

Vercel / Netlify

Backend:

Render / Railway / Fly.io / equivalent

Use environment variables.

---

# 20. Project Structure

Keep the project clean.

Example:

```text
virtual-salon/
│
├── client/
│   ├── src/
│   │   ├── components/
│   │   ├── game/
│   │   ├── player/
│   │   ├── salon/
│   │   ├── queue/
│   │   ├── multiplayer/
│   │   ├── audio/
│   │   ├── ui/
│   │   └── App.tsx
│
├── server/
│   ├── src/
│   │   ├── rooms/
│   │   ├── queue/
│   │   ├── players/
│   │   ├── agents/
│   │   └── index.ts
│
├── assets/
│
├── README.md
└── docker-compose.yml
```

The exact structure can be changed if there is a technically better approach.

---

# 21. Important Product Principle

Do not build unnecessary features.

The MVP needs to prove this loop:

```text
LANDING PAGE
      ↓
CHOOSE AVATAR
      ↓
ENTER SALON
      ↓
SEE REAL PLAYERS
      ↓
WALK AROUND
      ↓
JOIN QUEUE
      ↓
WAIT
      ↓
GET CALLED
      ↓
SIT IN CHAIR
      ↓
GET HAIRCUT
      ↓
FINISH
      ↓
WALK AROUND / SOCIALIZE
```

This must feel polished before adding additional features.

---

# 22. Multiplayer Testing

The finished application must be tested with multiple browser tabs/windows.

Test:

### Player A

joins salon.

### Player B

joins salon.

### Player C

joins salon.

Verify:

* All players see each other.
* Movement synchronizes.
* Names synchronize.
* Queue synchronizes.
* Queue position is correct.
* Wait time updates.
* Chairs cannot be double-booked.
* When Player A finishes, Player B becomes next.
* Disconnecting from the browser removes the player correctly.
* Reconnecting works.

---

# 23. Performance

Optimize for browser performance.

Use:

* GLTF/GLB assets
* compressed textures
* low-poly models
* instancing where useful
* lazy loading
* optimized lighting
* limited shadows
* compressed audio

The salon should load quickly.

Avoid downloading massive 3D assets.

---

# 24. Error Handling

Handle:

* Multiplayer server unavailable
* Connection lost
* Reconnection
* Full room
* Player disconnect
* Queue inconsistency
* Asset loading failure

Show friendly messages rather than technical errors.

Example:

> “Looks like the barber's Wi-Fi died. Reconnecting...”

---

# 25. Landing Page Personality

Use playful copy.

Hero:

> **WHILE AI WORKS.
> GET A HAIRCUT.**

Subheading:

> Your agent is grinding.
> You deserve a break.

Button:

> **ENTER SALON 💈**

Small footer:

> A virtual Indian salon for people who spend too much time talking to AI.

---

# 26. End Product

The final result should be something I can send to another developer and say:

> “Open this website.”

They open it.

Choose an avatar.

Enter a visually appealing Indian salon.

Other real people are already there.

They walk around using WASD.

They see the queue.

They join.

They see their estimated wait.

They chat with other developers.

They hear salon ambience and music.

Their AI agent appears to be working.

Eventually:

> 🔔 Your turn!

They sit in the barber chair.

The barber cuts their hair.

The haircut completes.

They leave the chair.

The queue moves.

Everything happens in real time.

---

# 27. Build Philosophy

**Do not stop at a prototype screen.**

Build the complete playable product from scratch.

If an asset is unavailable, create a simple procedural/stylized replacement rather than blocking development.

If a feature is too complex, implement the simplest robust version that preserves the experience.

Prioritize:

1. Playability
2. Multiplayer reliability
3. Smooth movement
4. Queue correctness
5. Visual polish
6. Atmosphere
7. AI-agent architecture
8. Extra features

The goal is a **small but genuinely playable multiplayer web game**, not a technical demo.

At completion:

* Run the application locally
* Test it with multiple browser sessions
* Fix obvious bugs
* Optimize loading/performance
* Ensure production build works
* Provide exact setup instructions
* Provide deployment instructions
* Provide environment variable documentation
* Provide a README
* Do not leave TODO placeholders for core functionality
