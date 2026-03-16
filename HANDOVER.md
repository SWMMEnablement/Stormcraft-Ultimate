# SWMMCRAFT Ultimate - Detailed Handover Document

## Table of Contents
1. [Project Overview](#project-overview)
2. [Architecture Summary](#architecture-summary)
3. [Data Model](#data-model)
4. [Frontend Deep Dive](#frontend-deep-dive)
5. [Backend & Database](#backend--database)
6. [Visual / Aesthetic System](#visual--aesthetic-system)
7. [Steve - The AI Companion Character](#steve---the-ai-companion-character)
8. [Simulation Engine](#simulation-engine)
9. [Tutorial System](#tutorial-system)
10. [Challenge / Level System](#challenge--level-system)
11. [Budget System](#budget-system)
12. [SWMM .inp Import/Export](#swmm-inp-importexport)
13. [Demo Overlay (Scripted Intro)](#demo-overlay-scripted-intro)
14. [Sound System](#sound-system)
15. [UI Component Inventory](#ui-component-inventory)
16. [CSS & Theming](#css--theming)
17. [Keyboard Shortcuts](#keyboard-shortcuts)
18. [State Management](#state-management)
19. [Build & Deployment](#build--deployment)
20. [File Tree Reference](#file-tree-reference)
21. [Known Limitations & Future Work](#known-limitations--future-work)

---

## Project Overview

SWMMCRAFT Ultimate is a web-based Storm Water Management Model (SWMM) visualization and simulation tool with a fully realized Minecraft-inspired pixel art aesthetic. Users design drainage networks by placing nodes (junctions, outfalls, storage units, rain gauges), connecting them with conduit pipes, and running simplified hydrological simulations to observe water flow, flooding, and surcharge events.

The app is designed to look and feel like a **game**, not a web app. It features:
- Pixel-art terrain tiles (grass, dirt, pavement) rendered on HTML5 Canvas
- Block-style pipes with rivets and visible inner flow animation
- Manhole-cover junction nodes, outfall sprites with flow arrows, storage tanks with fill levels
- Animated pixel rain falling from block clouds that drift across the sky
- Blue flooding blocks that orbit overwhelmed nodes with wave animation
- A 32x32 pixel "Steve" companion character wearing a hard hat and safety vest
- A bottom inventory hotbar (Minecraft-style) instead of a sidebar toolbar
- A compact 40px game HUD header bar
- Challenge levels with increasing difficulty and budget constraints
- Full SWMM5 `.inp` file import and export
- A scripted demo overlay that walks new users through building their first network

---

## Architecture Summary

```
┌──────────────────────────────────────────────────────┐
│  Frontend (React + Vite + TypeScript)                │
│  ┌──────────────────────────────────────────────┐    │
│  │ Home.tsx (single page - all state lives here)│    │
│  │  ├── Header (compact game HUD bar)           │    │
│  │  ├── MapCanvas (HTML5 Canvas - main view)    │    │
│  │  ├── Toolbar (bottom inventory hotbar)       │    │
│  │  ├── SimulationControls (top-left overlay)   │    │
│  │  ├── BudgetBar (below sim controls)          │    │
│  │  ├── Minimap (top-right overlay)             │    │
│  │  ├── PropertiesPanel (right sidebar)         │    │
│  │  ├── ProfileCanvas (bottom resizable panel)  │    │
│  │  ├── TutorialOverlay                         │    │
│  │  └── DemoOverlay (scripted intro)            │    │
│  └──────────────────────────────────────────────┘    │
│                                                      │
│  Libraries:                                          │
│    swmm-types.ts, steve.ts, tutorial.ts,             │
│    budget.ts, challenges.ts, sound.ts,               │
│    inp-parser.ts, swmm-export.ts, api.ts             │
├──────────────────────────────────────────────────────┤
│  Backend (Express + TypeScript)                      │
│  ┌──────────────────────────────────────────────┐    │
│  │ routes.ts → /api/projects CRUD               │    │
│  │ storage.ts → DatabaseStorage (Drizzle ORM)   │    │
│  │ db.ts → PostgreSQL connection pool            │    │
│  └──────────────────────────────────────────────┘    │
├──────────────────────────────────────────────────────┤
│  Database (PostgreSQL)                               │
│  └── projects table (id, name, description,          │
│      modelData JSONB, createdAt, updatedAt)          │
└──────────────────────────────────────────────────────┘
```

**Routing**: `wouter` with a single route `/` mapping to `Home.tsx`. A `not-found.tsx` 404 page exists for unknown routes.

**Dev Server**: Express serves Vite middleware for HMR in development. In production, Vite builds to `dist/public` and Express serves static files.

---

## Data Model

### Core Types (`client/src/lib/swmm-types.ts`)

```typescript
type NodeType = 'junction' | 'outfall' | 'storage' | 'raingauge';
type LinkType = 'conduit';

interface Node {
  id: string;           // e.g., "J1", "O1", "S1", "R1"
  type: NodeType;
  x: number;            // World-space X coordinate
  y: number;            // World-space Y coordinate
  invertElev: number;   // Invert elevation (ft)
  maxDepth: number;     // Maximum depth before surcharge (ft)
  depth: number;        // Current simulation depth (ft)
  isSurcharged: boolean; // True when depth >= maxDepth
}

interface Link {
  id: string;           // e.g., "C1"
  type: LinkType;
  fromNode: string;     // Source node ID
  toNode: string;       // Destination node ID
  length: number;       // Pipe length (ft) - auto-calculated from node positions
  roughness: number;    // Manning's n (default 0.013)
  flow: number;         // Current simulation flow
  capacity: number;     // Maximum flow capacity
}

interface Subcatchment {
  id: string;           // e.g., "S1"
  type: 'subcatchment';
  points: Point[];      // Polygon vertices
  area: number;         // Area in acres
  percentImperv: number; // Impervious percentage
  outletNode: string | null; // Drains to this node
}

interface SWMMState {
  nodes: Node[];
  links: Link[];
  subcatchments: Subcatchment[];
}
```

### Steve Character State

```typescript
type SteveEmotion = 'idle' | 'walking' | 'inspecting' | 'pointing'
                   | 'worried' | 'swimming' | 'celebrating' | 'sleeping';

interface SteveState {
  x: number;               // World-space position
  y: number;
  targetNodeId: string | null; // Node Steve is walking toward
  action: SteveEmotion;
  facingRight: boolean;
  animFrame: number;       // 0-59 animation counter
  speech: string | null;   // Current speech bubble text
  inspectionTimer: number; // Countdown for inspection duration
  tutorialSpeech: string | null; // Overrides regular speech during tutorial
}
```

### Database Schema (`shared/schema.ts`)

Single `projects` table:
| Column | Type | Notes |
|--------|------|-------|
| `id` | `varchar` (UUID) | Auto-generated via `gen_random_uuid()` |
| `name` | `text` | Project name |
| `description` | `text` | Optional description |
| `modelData` | `jsonb` | Full `SWMMState` serialized as JSON |
| `createdAt` | `timestamp` | Auto-set on creation |
| `updatedAt` | `timestamp` | Updated on every save |

The entire model (nodes, links, subcatchments) is stored as a single JSONB blob rather than normalized tables. This simplifies save/load since the model is always manipulated as a whole.

---

## Frontend Deep Dive

### Home.tsx - The Master Controller

`Home.tsx` is the single page component that owns **all** application state:

**State Variables:**
| State | Type | Purpose |
|-------|------|---------|
| `model` | `SWMMState` | The drainage network (nodes, links, subcatchments) |
| `activeTool` | `Tool` | Currently selected tool from the hotbar |
| `selectedId` | `string \| null` | ID of the selected element for properties panel |
| `is3D` | `boolean` | Whether pseudo-3D rendering is active |
| `showProfile` | `boolean` | Whether the profile view panel is visible |
| `theme` | `'light' \| 'dark'` | Day/night theme toggle |
| `steve` | `SteveState` | Steve character's current state |
| `tutorial` | `TutorialState` | Tutorial progress tracking |
| `budget` | `BudgetConfig` | Current budget configuration |
| `challenge` | `ChallengeLevel \| null` | Active challenge level |
| `simTime` | `number` | Simulation clock (0-24 hours) |
| `isPlaying` | `boolean` | Whether simulation is running |
| `simSpeed` | `number` | Simulation speed multiplier (1x or 5x) |
| `showDemo` | `boolean` | Whether to show the demo overlay |

**Intervals/Loops:**
1. **Steve Tick Loop** (`setInterval` at 150ms): Updates Steve's AI - movement, emotion, speech, target selection
2. **Simulation Loop** (`setInterval` at 100ms when playing): Advances simulation time, calculates water depth at each node, calculates flow through each link

**Layout Structure:**
```
┌─────────────────────────────────────────────────┐
│ Header (40px game HUD bar)                      │
├──────────────────────────────────┬──────────────┤
│                                  │              │
│  MapCanvas (main view)           │  Properties  │
│    ┌──────────┐  ┌────────┐     │  Panel       │
│    │SimCtrl   │  │Minimap │     │  (right      │
│    │BudgetBar │  │        │     │   sidebar)   │
│    └──────────┘  └────────┘     │              │
│                                  │              │
│  ┌──────────────────────────┐   │              │
│  │ Toolbar (inventory bar)  │   │              │
│  └──────────────────────────┘   │              │
├──────────────────────────────────┤              │
│ ProfileCanvas (optional, toggle) │              │
└──────────────────────────────────┴──────────────┘
```

The main area and properties panel are separated by a resizable divider (`ResizablePanelGroup`). The map area and profile view (when visible) are also separated by a resizable divider.

### MapCanvas.tsx - The Heart of the App (721 lines)

This is the primary canvas-based rendering component. Everything is drawn using the HTML5 Canvas 2D API with `imageSmoothingEnabled = false` for crisp pixel art.

**Rendering Pipeline (per frame via `requestAnimationFrame`):**

1. **Sky background** - Clear canvas with `#87CEEB` (sky blue)
2. **3D transform** (if enabled) - Scale Y by 0.6 for isometric-ish perspective
3. **Camera transform** - Apply pan (`transform.x`, `transform.y`) and zoom (`transform.k`)
4. **Terrain tiles** - Fill visible viewport with 32x32 pixel tiles:
   - Grass tiles near empty areas (2 shades + accent dots + random tiny trees)
   - Pavement tiles near nodes and links (gray with grid lines)
   - Tile variation is deterministic via `seededRandom(x, y)` so tiles don't flicker
5. **Subcatchments** - Semi-transparent green polygons with dashed outlines
6. **Links (Conduit pipes)** - Rendered as filled quads (not strokes):
   - Outer pipe body (dark gray `#555`)
   - Inner pipe channel (darker `#444`)
   - Rivet dots along both edges (every 24px)
   - Animated flow particles (blue dots moving along pipe when flow > 0)
   - Dashed white outline when selected
7. **Nodes** - Each type has distinct pixel art:
   - **Junction**: Gray square manhole cover with circle/cross pattern. Shadow offset in 3D mode.
   - **Outfall**: Green square with blue water stripe and white flow arrow. Wave animation on water.
   - **Storage**: Gold/brown tank, taller than wide. Blue fill level rises with depth.
   - **Rain Gauge**: Purple square with animated blue rain drops inside.
8. **Flooding effects** (when nodes have depth > 0):
   - Blue block squares orbit the node at increasing radius based on depth
   - Wave offset animation (`sin(frame * 0.08)`)
   - At >50% depth: blue rectangular spread area appears
   - When surcharged: pulsing red ring + red "!" exclamation label
9. **Rain system** (during simulation):
   - Rain drops: short blue diagonal lines falling at varying speeds
   - Drop count scales with rain intensity (peaks at hour 6)
   - Block clouds: rectangular grids of 16x16 blocks that drift rightward
   - Cloud highlight strips on top rows for 3D effect
10. **Steve** - Drawn via shared `drawSteve()` function from `steve.ts`
11. **Node labels** - White "Press Start 2P" font, 8px, with text shadow

**Interaction Handling:**
- **Pan**: Middle-click drag or Pan tool drag
- **Zoom**: Mouse wheel (`0.1x` to `5x` range)
- **Select**: Click on nodes (15px hit radius), links (10px perpendicular distance), or subcatchments (point-in-polygon test)
- **Place Node**: Click with junction/outfall/storage/raingauge tool. Auto-generates ID like `J1`, `O1`, `S1`, `R1`
- **Draw Conduit**: Click first node (start), then click second node (end). Dashed line preview while pending.
- **Draw Subcatchment**: Click to add polygon vertices, double-click to close polygon.
- Sound effects play on every interaction (`playClick()` for selections, `playPlop()` for placements)

**Persistent Refs:**
- `rainRef` - Array of rain drop positions (persists across renders)
- `cloudsRef` - Array of cloud block positions (initialized once with 6 clouds)
- `floodAnimRef` - Frame counter for flood/wave animations

### Toolbar.tsx - Inventory Hotbar

Absolutely positioned at bottom-center of the map canvas (`z-30`). Contains 9 tool slots + 1 3D toggle button.

Each tool slot is a 48x48 button with:
- A `<canvas>` element that draws a 24x24 pixel icon programmatically (manhole cover for junction, pipe for conduit, trash can for delete, etc.)
- A slot number overlay (1-9) in top-right corner
- An active tool label below the selected slot
- Outset border styling for 3D button effect
- Active slot scales up 110% with white border glow

**Tool List:**
| Slot | Tool | Icon Description |
|------|------|-----------------|
| 1 | Select | White cursor arrow |
| 2 | Pan | White cross/arrows |
| 3 | Junction | Gray manhole cover square |
| 4 | Outfall | Green square with blue water + white arrow |
| 5 | Storage | Gold tank with blue water fill |
| 6 | Conduit | Gray pipe with blue flow + rivet dots |
| 7 | Subcatchment | Semi-transparent green polygon |
| 8 | Rain Gauge | Purple square with blue rain drops |
| 9 | Delete | Red trash can with white lines |
| - | 3D Toggle | Purple isometric cube (separate button) |

### SimulationControls.tsx

Top-left overlay panel with dark game-panel styling:
- Digital clock display (green `#00FF00`-style on black background, "Press Start 2P" font)
- Rain intensity bar (8 vertical bars, blue when active)
- Time scrubber slider (0-24 hours)
- RESET / PLAY(PAUSE) / SPEED buttons (mc-btn-sm styled)
- Status text: "SIMULATING" (green) or "READY" (gray)
- Current rainfall rate in mm/hr

### BudgetBar.tsx

Appears below simulation controls only when a challenge is active (budget is not Infinity):
- "BUDGET" label with remaining amount in color (green/yellow/red)
- Progress bar showing spent vs total
- Spent and total amounts at bottom

### Minimap.tsx

Top-right overlay, 120x120 canvas with dark background (`#1a1a2e`):
- Links drawn as thin gray lines
- Nodes drawn as 4x4 colored squares (gray=junction, green=outfall, gold=storage, purple=raingauge)
- Steve shown as a 4x4 cyan square
- Auto-scales to fit all nodes with padding

### PropertiesPanel.tsx

Right sidebar with `mc-panel` styling (outset border, gray background). Shows dynamic fields based on selected element type:
- **All**: ID (read-only)
- **Nodes**: Invert Elevation, Max Depth
- **Links**: Roughness, Length, From Node, To Node
- **Subcatchments**: Area, % Impervious, Outlet Node, Vertex Count

Uses `mc-input` styled inputs (black background, green text, retro terminal look).

### ProfileCanvas.tsx

Optional bottom panel (toggled via PROFILE button). Shows a side profile/cross-section view of the drainage network. Appears in a resizable panel below the main map.

### ProjectManager.tsx

Dropdown in the header for saving/loading projects via the REST API. Uses React Query for server state management.

### ImportDialog.tsx

Dialog for importing standard SWMM `.inp` files. Parses the file content and loads the model into the app.

### ChallengePicker.tsx

Dropdown/dialog for selecting challenge levels. Shows level name, difficulty, storm intensity, and budget.

---

## Backend & Database

### API Routes (`server/routes.ts`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/projects` | List all projects, ordered by `updatedAt` |
| `GET` | `/api/projects/:id` | Get a single project by UUID |
| `POST` | `/api/projects` | Create new project (validates with `insertProjectSchema`) |
| `PATCH` | `/api/projects/:id` | Update project (validates with `updateProjectSchema`) |
| `DELETE` | `/api/projects/:id` | Delete project, returns 204 |

All routes use the `IStorage` interface, making it easy to swap storage backends.

### Storage (`server/storage.ts`)

`DatabaseStorage` class implements `IStorage` using Drizzle ORM queries. On update, `updatedAt` is auto-set to `new Date()`.

### Client API (`client/src/lib/api.ts`)

Typed fetch wrappers for all 5 endpoints. Throws on non-OK responses. Used by `ProjectManager.tsx` via React Query.

---

## Visual / Aesthetic System

### Design Philosophy

Every visual element is designed to evoke Minecraft's aesthetic:
- **No rounded corners** (`--radius: 0rem` in CSS)
- **Pixel-perfect rendering** (`image-rendering: pixelated` on body)
- **Outset/inset borders** for 3D button effects
- **Press Start 2P** font for headings, labels, and HUD elements
- **VT323** monospace font for body text and inputs
- **Dark panels** with `bg-black/80` and `border-gray-600` for overlays
- **Text shadow** (`1px 1px 0 #000`) for legibility on dark backgrounds

### Color Palette

**Terrain:**
- Grass: `#5B8C32` (light), `#4A7A28` (dark), `#6B9C3E` (accent)
- Dirt: `#8B6914`, `#6B4F10`
- Stone/Pavement: `#888888`, `#666666`, `#AAAAAA`, `#777777`

**Water:**
- Surface: `#3B7DD8`
- Deep: `#2B5DAA`
- Highlight: `#6BA8E8`
- Flood: `#4A90E2`

**Pipes:**
- Outer: `#555555`
- Inner: `#444444`
- Rivet: `#888888`
- Flow: `#4A90E2` (same as water)

**Steve:**
- Skin: `#F9C9A9` / Shadow: `#D4A07A`
- Hard hat: `#FFD700` / Brim: `#E6B800` / Stripe: `#FF8C00`
- Vest: `#FF6600` / Stripe: `#FFFF00` / Dark: `#CC5500`
- Pants: `#283593` / Dark: `#1A237E`
- Shoes: `#333333` / Sole: `#111111`

**Emotion Variants:**
- Worried vest: `#FF4444` (red)
- Swim vest: `#2196F3` (blue)
- Celebrate vest: `#FFD700` (gold)

### CSS Utility Classes

| Class | Description |
|-------|-------------|
| `.mc-btn` | Full-size Minecraft button (outset border, text-shadow, gray) |
| `.mc-btn-sm` | Small button (7px Press Start 2P, outset border) |
| `.mc-btn-primary-sm` | Blue variant of mc-btn-sm |
| `.mc-btn-primary` | Blue variant of mc-btn |
| `.mc-btn-danger` | Red variant of mc-btn |
| `.mc-panel` | Outset-bordered panel (gray background) |
| `.mc-input` | Retro terminal input (black bg, green text, inset border) |

### Day/Night Theme

Two theme modes controlled by `theme` state and `.dark` class on body:
- **Day (Light)**: Sky blue background, lighter card colors
- **Night (Dark)**: Deep navy background (`#0D1B2A`), darker panels

---

## Steve - The AI Companion Character

Steve is a 32x32 pixel character drawn entirely with code (no sprite images). He wears a yellow hard hat, orange safety vest with yellow stripes, blue pants, and black shoes.

### Rendering (`steve.ts` - `drawSteve()`)

The drawing function uses a `px()` helper to fill rectangles for pixel-art construction. Steve is composed of:
- **Head**: 8x8 skin-colored block with facial features that change per emotion
- **Hard Hat**: Gold hat with orange stripe and brim overhang
- **Body**: Safety vest with horizontal yellow stripes
- **Arms**: Skin-colored rectangles with rotation for animation
- **Legs**: Blue pants with black shoes, rotation for walk cycle
- **Shadow**: Semi-transparent ellipse below feet

**Emotion-Specific Rendering:**
| Emotion | Visual |
|---------|--------|
| `idle` | Standing still, arms at sides |
| `walking` | Leg/arm swing animation (4-frame walk cycle) |
| `inspecting` | Holding a clipboard with paper lines |
| `pointing` | Extended arm with pointing finger, pulsing circle indicator |
| `worried` | Red vest, raised eyebrows, "O" mouth |
| `swimming` | Blue vest, only head/arms visible above blue water layer, swimming arm motion |
| `celebrating` | Gold vest, jumping animation, sparkle particles orbit around head |
| `sleeping` | Lying flat horizontally, closed eyes, animated "Z" letters float upward |

### AI Behavior (`steve.ts` - `updateSteve()`)

Steve's behavior is a state machine updated every 150ms:

1. **Tutorial Override**: If `tutorialSpeech` is set, Steve displays that instead of autonomous speech
2. **Flooding Check**: If Steve is near a surcharged node during simulation, he switches to `swimming` and calls for help
3. **Surcharge Alert**: If any node is surcharged, Steve becomes `worried` and may walk toward the problem node
4. **Post-Simulation**: After sim reaches hour 24:
   - First `celebrating` (with pass/fail speech) for 120 ticks
   - Then `sleeping` with "Zzz..." for 300 ticks
   - Then back to `idle`
5. **Idle Behavior**: 5% chance per tick to pick a random node as target and start `walking`
6. **Walking**: Moves toward target node at speed 2 (or 4 if worried). When within 20px, switches to `inspecting`
7. **Inspecting**: Displays contextual speech about the node (capacity %, type info, tips) for 120 ticks, then returns to `idle`

### Speech Bubble

Rendered directly on canvas above Steve. Features:
- Auto-wrapping text (200px max width)
- Rounded rectangle background with pointer triangle
- Color-coded by emotion (yellow for worried, green for swimming, gold for celebrating)
- "Press Start 2P" font at 11px

### Inspection Speech Generation

Steve generates contextual comments based on the node he's inspecting:
- Outfalls: Reports elevation
- Storage: Reports capacity percentage
- Junctions with many upstream pipes and high fill: Warns about needing bigger pipes
- Dead-end junctions: Warns about missing downstream connection
- >90% full: "SURCHARGE IMMINENT!"
- >50% full: "Handling it, but watch during peak storm"
- 30% chance of showing a random tip from `SMART_HINTS` array

---

## Simulation Engine

The simulation is a simplified hydrological model that runs in the browser (no server-side computation).

### Time
- 24-hour simulation period (0:00 to 24:00)
- Real-time at 100ms intervals, adjustable speed (1x or 5x)
- Storm peaks at hour 6 with Gaussian-like intensity curve: `intensity * exp(-|time - 6| * 0.3)`

### Hydraulic Calculations (per tick)

For each node:
```
rainIntensity = stormIntensity * exp(-|time - 6| * 0.3)
inflow = rainIntensity * 2 + sum(upstream link flows) * 0.3
outflow = (has downstream links) ? depth * 0.5 : depth * 0.1
newDepth = max(0, depth + (inflow - outflow) * 0.05)
isSurcharged = (maxDepth > 0) && (newDepth >= maxDepth)
```

For each link:
```
flow = max(0, upstreamNode.depth * 1.5)
```

This is a greatly simplified model compared to real SWMM's Saint-Venant equations, but it produces visually meaningful behavior for educational/gaming purposes.

---

## Tutorial System

### Structure (`tutorial.ts`)

8-step guided tutorial (indices 0-7) with Steve as instructor:

| Step | ID | Action Required | Steve Says |
|------|----|----------------|------------|
| 0 | `welcome` | Auto-advance (4s) | "Hi! I'm Steve, your drainage engineer!" |
| 1 | `place_junction_1` | Place a junction | "Press J to select the Junction tool..." |
| 2 | `place_junction_2` | Place another junction | "Great job! Now place a second junction..." |
| 3 | `place_outfall` | Place an outfall | "Press O to place an Outfall..." |
| 4 | `connect_conduit_1` | Draw a conduit | "Press C for Conduit mode..." |
| 5 | `connect_conduit_2` | Draw another conduit | "One more pipe! Connect to the outfall..." |
| 6 | `start_sim` | Start simulation | "Your network is ready! Hit PLAY..." |
| 7 | `complete` | Auto-advance (5s) | "You built your first drainage network!" |

### State Machine
```typescript
TutorialState {
  active: boolean;      // Tutorial is currently running
  currentStep: number;  // Index into TUTORIAL_STEPS
  completed: boolean;   // All steps done
  dismissed: boolean;   // User clicked "Skip Tutorial"
}
```

The `advanceTutorial()` function matches events (`node_added`, `link_added`, `sim_started`) against the current step's `requiredAction` to determine whether to advance.

### Visual
- Steps with `glowPosition` show a suggested placement location
- Steps with `highlightTool` auto-select that tool
- Tutorial speech overrides Steve's normal speech via `tutorialSpeech`
- TutorialOverlay component shows the instruction text

---

## Challenge / Level System

### 6 Challenge Levels (`challenges.ts`)

| # | Name | Storm | Intensity | Terrain | Budget | Flood Tolerance |
|---|------|-------|-----------|---------|--------|----------------|
| 1 | Gentle Rain | 2-yr | 0.3 | flat | $500K | 0.5 ft |
| 2 | Downpour | 10-yr | 0.6 | slopes | $400K | 0.3 ft |
| 3 | Flash Flood | 25-yr | 0.8 | steep | $350K | 0.2 ft |
| 4 | Hurricane | 100-yr | 1.0 | coastal | $300K | 0.1 ft |
| 5 | Climate Change | 500-yr | 1.5 | extreme | $250K | 0.05 ft |
| 6 | The Impossible Basin | 1000-yr | 2.0 | extreme | $200K | IMPOSSIBLE |

Level 6 is a "boss level" where the goal isn't to prevent flooding but to minimize damage. Scoring uses a damage reduction formula instead of pass/fail.

### Performance Evaluation

```
score = 70 + efficiency_bonus - flood_penalty
efficiency_bonus = max(0, (budget - spent) / budget * 30)
flood_penalty = max(0, (flood - allowed) * 50)
grade: S (95+), A (85+), B (70+), C (50+), F (<50)
```

Boss level uses: `score = max(0, 100 - maxFloodDepth * 10)` with grades S/A/B/C/D.

---

## Budget System

### Cost Structure (`budget.ts`)

| Item | Default Cost |
|------|-------------|
| Junction | $10,000 |
| Outfall | $25,000 |
| Storage Unit | $50,000 |
| Rain Gauge | $5,000 |
| Conduit | $100/ft |

**Sandbox Mode**: All costs are $0 with Infinity budget (no BudgetBar shown).

**Challenge Mode**: Budget is set by the challenge level. `canAfford()` function checks remaining budget before allowing placement.

---

## SWMM .inp Import/Export

### Import (`inp-parser.ts`)

Parses standard EPA SWMM5 `.inp` file format. Handles sections:
- `[JUNCTIONS]` - Parses ID, elevation, max depth
- `[OUTFALLS]` - Parses ID, elevation
- `[STORAGE]` - Parses ID, elevation, max depth
- `[RAINGAGES]` - Parses ID
- `[CONDUITS]` - Parses ID, from/to nodes, length, roughness
- `[SUBCATCHMENTS]` - Parses ID, rain gage, outlet, area, imperviousness
- `[COORDINATES]` - Applies X/Y positions to nodes
- `[POLYGONS]` - Applies polygon vertices to subcatchments

Coordinates are normalized to fit within 800x600 screen space with Y-axis flipped (SWMM uses bottom-up Y). Nodes without coordinates get default positions.

### Export (`swmm-export.ts`)

Generates a complete `.inp` file with:
- `[TITLE]`, `[OPTIONS]` (CFS units, DYNWAVE routing, 24-hour period)
- `[RAINGAGES]`, `[JUNCTIONS]`, `[OUTFALLS]`, `[STORAGE]`
- `[CONDUITS]`, `[XSECTIONS]` (all circular, 2ft diameter)
- `[SUBCATCHMENTS]`, `[SUBAREAS]`
- `[COORDINATES]`, `[Polygons]`, `[REPORT]`

Export triggers a browser download of the `.inp` file.

---

## Demo Overlay (Scripted Intro)

`DemoOverlay.tsx` (605 lines) is a full-screen animated introduction that plays on first visit (tracked via `sessionStorage`).

### Phases
The demo progresses through ~16 phases:
1. `intro` - Title card
2. `steve_walks_to_spot` - Steve walks to a position
3. `place_junction_prompt` - Steve explains junctions
4. `click_junction_1` - Automated junction placement
5. Additional phases for second junction, outfall, conduit drawing
6. `rain_start` - Rain begins
7. `simulation` - Water flows through the network
8. `celebrate` - Steve celebrates

The overlay renders its own self-contained SWMM network with demo nodes, links, rain, and Steve character. It uses the shared `drawSteve()` function from `steve.ts`.

Users can dismiss the overlay at any time. Once dismissed, `sessionStorage.setItem('swmmcraft_demo_seen', '1')` prevents it from showing again in that session.

---

## Sound System

`sound.ts` uses the Web Audio API to generate sounds programmatically (no audio files):

### `playClick()`
- Square wave oscillator
- Frequency sweep: 800Hz → 400Hz over 50ms
- Gain: 0.1 → 0.01 (quick decay)
- Used for: tool selection, element selection

### `playPlop()`
- Sine wave oscillator
- Frequency sweep: 400Hz → 600Hz over 100ms
- Gain: 0.2 → 0.01 over 200ms
- Used for: placing nodes, completing conduits, closing subcatchments

---

## UI Component Inventory

### SWMM Components (`client/src/components/SWMM/`)

| Component | Purpose | Approx. Lines |
|-----------|---------|---------------|
| `MapCanvas.tsx` | Main canvas rendering and interaction | ~720 |
| `DemoOverlay.tsx` | Scripted intro animation | ~605 |
| `Toolbar.tsx` | Bottom inventory hotbar with pixel icons | ~215 |
| `PropertiesPanel.tsx` | Right sidebar property editor | ~145 |
| `SimulationControls.tsx` | Play/pause/speed/time controls | ~95 |
| `TutorialOverlay.tsx` | Step-by-step tutorial display | ~80 |
| `Minimap.tsx` | Small overview map | ~85 |
| `BudgetBar.tsx` | Budget progress display | ~50 |
| `Header.tsx` | Compact game HUD bar | ~50 |
| `ProfileCanvas.tsx` | Side profile view | ~100 |
| `ProjectManager.tsx` | Save/load project dropdown | ~100 |
| `ImportDialog.tsx` | SWMM .inp file import dialog | ~60 |
| `ChallengePicker.tsx` | Challenge level selection | ~80 |

### Shadcn/UI Components (`client/src/components/ui/`)

Full library of ~50 Radix-based primitives including: accordion, alert-dialog, button, card, checkbox, dialog, dropdown-menu, input, label, popover, progress, resizable, scroll-area, select, separator, slider, switch, tabs, toast, tooltip, and more. These provide accessible, unstyled primitives that are themed via CSS variables.

---

## CSS & Theming

### Fonts
- **Press Start 2P**: Used for HUD labels, buttons, clock display, node labels (loaded via Google Fonts CDN)
- **VT323**: Default body/sans font for all other text (loaded via Google Fonts CDN)

### Pixel Art Rendering
`image-rendering: pixelated` is set on `body` globally and on individual canvas elements to prevent antialiasing.

### Border Radius
`--radius: 0rem` ensures no rounded corners anywhere (Minecraft aesthetic).

### Theme Variables
CSS custom properties define the color palette. Both `:root` (light) and `.dark` variants are defined. Key colors:
- Primary: `#4A90E2` (Water Blue)
- Secondary: `#50E3C2` (Flow Cyan)
- Background: Light sky blue (light mode) / Deep navy (dark mode)

---

## Keyboard Shortcuts

Currently keyboard shortcuts are referenced in tutorial/Steve hints but not all are wired in `Home.tsx`:
- **V**: Select mode (referenced in Steve tips)
- **J**: Junction tool
- **O**: Outfall tool
- **C**: Conduit tool
- **Tab**: Toggle 3D (referenced in Toolbar tooltip)
- **1-9**: Tool slots (referenced in Toolbar)

---

## State Management

All state lives in `Home.tsx` as local React state (`useState`). There is no global store (Redux, Zustand, etc.).

**Server state** for project CRUD uses `@tanstack/react-query` in `ProjectManager.tsx`.

**Ephemeral state** (demo seen flag) uses `sessionStorage`.

---

## Build & Deployment

### Development
```bash
npm run dev  # Starts Express with Vite middleware for HMR on port 5000
```

### Production Build
```bash
npm run build  # Runs script/build.ts
```
Build process:
1. Vite builds client to `dist/public/`
2. esbuild bundles server to `dist/index.cjs`

### Production Start
```bash
npm start  # NODE_ENV=production node dist/index.cjs
```

### Database
```bash
npm run db:push  # Drizzle kit pushes schema to PostgreSQL
```

### Environment Variables
| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `NODE_ENV` | No | `development` or `production` |

---

## File Tree Reference

```
├── client/
│   ├── index.html
│   └── src/
│       ├── App.tsx                    # Router setup
│       ├── main.tsx                   # React entry point
│       ├── index.css                  # Tailwind + custom MC classes
│       ├── components/
│       │   ├── SWMM/
│       │   │   ├── MapCanvas.tsx      # Main canvas (721 lines)
│       │   │   ├── DemoOverlay.tsx    # Scripted intro (605 lines)
│       │   │   ├── Toolbar.tsx        # Bottom hotbar
│       │   │   ├── Header.tsx         # Game HUD bar
│       │   │   ├── PropertiesPanel.tsx# Right sidebar
│       │   │   ├── SimulationControls.tsx
│       │   │   ├── BudgetBar.tsx
│       │   │   ├── Minimap.tsx
│       │   │   ├── ProfileCanvas.tsx
│       │   │   ├── ProjectManager.tsx
│       │   │   ├── ImportDialog.tsx
│       │   │   ├── ChallengePicker.tsx
│       │   │   └── TutorialOverlay.tsx
│       │   └── ui/                    # ~50 Shadcn components
│       ├── hooks/
│       │   ├── use-mobile.tsx
│       │   └── use-toast.ts
│       ├── lib/
│       │   ├── swmm-types.ts          # Core type definitions
│       │   ├── steve.ts               # Steve AI + rendering (592 lines)
│       │   ├── tutorial.ts            # Tutorial system
│       │   ├── budget.ts              # Budget calculations
│       │   ├── challenges.ts          # Challenge levels
│       │   ├── sound.ts               # Web Audio sounds
│       │   ├── inp-parser.ts          # SWMM .inp import
│       │   ├── swmm-export.ts         # SWMM .inp export
│       │   ├── api.ts                 # REST API client
│       │   ├── queryClient.ts         # React Query config
│       │   └── utils.ts              # cn() utility
│       └── pages/
│           ├── Home.tsx               # Main page (332 lines)
│           └── not-found.tsx
├── server/
│   ├── index.ts                       # Express entry point
│   ├── routes.ts                      # API routes
│   ├── storage.ts                     # IStorage + DatabaseStorage
│   ├── db.ts                          # Drizzle + pg pool
│   ├── vite.ts                        # Vite dev middleware
│   └── static.ts                      # Static file serving
├── shared/
│   └── schema.ts                      # Drizzle schema + Zod types
├── script/
│   └── build.ts                       # Production build script
├── package.json
├── tsconfig.json
├── vite.config.ts
├── drizzle.config.ts
└── replit.md
```

---

## Known Limitations & Future Work

### Current Limitations
1. **Stubbed Header Actions**: Undo, Redo, Copy, Paste, and Auto Layout buttons exist in the header and props are fully wired, but their handlers in `Home.tsx` are intentionally stubbed as `() => {}` - no implementation yet
2. **Delete Tool**: Tool slot exists in the hotbar but deletion logic is not implemented in MapCanvas
3. **Keyboard Shortcuts**: Referenced in tutorial hints and tooltips but not wired up as event listeners
4. **ID Namespace Collision**: Storage nodes use `S#` prefix and subcatchments also use `S#` prefix, which can cause ambiguous selection. Element lookup in `Home.tsx` resolves nodes before subcatchments, so a storage node `S1` would shadow a subcatchment `S1`
5. **Simulation Accuracy**: Simplified hydraulic model - not meant for real engineering calculations
6. **No Zoom-to-Fit**: No automatic camera positioning when loading a model
7. **No Multi-Select**: Can only select one element at a time
8. **Profile View**: Basic implementation, could show more detail
9. **Challenge Completion**: `evaluatePerformance()` function exists in challenges.ts but no UI dialog shows the grade/score at simulation end
10. **No Node Dragging**: Nodes cannot be repositioned after placement

### Potential Enhancements
- Wire up undo/redo with a model history stack
- Implement delete tool (remove selected node/link)
- Add keyboard shortcut listeners in Home.tsx
- Show challenge results dialog after simulation completes
- Add node dragging in select mode
- Implement terrain types per challenge (slopes, coastal)
- Add more Steve animations and context-aware commentary
- Multiplayer via WebSocket (ws dependency already installed)
- Export simulation results as CSV/chart
- Mobile/touch support

---

## Independent Assessment & Improvement Plan

This is a mature, production-scale application managing 1,000+ real engineering models. The self-grading at 92 is reasonable — here is an independent assessment with a detailed improvement plan.

---

### Overall Grade: A / 92

The self-grade is accurate. Strong infrastructure, impressive data scale, and genuine engineering utility. The score ceiling is held down by the content search O(n) bottleneck, no full-text index, placeholder integrations, and the insights cache being a module variable rather than a proper cache layer.

---

### Category Grades

| Category | Grade | Rationale |
| --- | --- | --- |
| Architecture & Data Layer | A | GCS + PostgreSQL split is correct; dual-store is clean |
| Dashboard & File Browser | A | Collapsible dirs, quick access, content search all solid |
| AI Health Scoring | B+ | Client-side scoring is fast but deterministic rule-based only |
| ReSWMM Discretization | A | Pachaly algorithm correctly implemented, per-directory apply |
| Minecraft Map Visualization | A- | Impressive scope; biome themes and isometric view are unique |
| Compare / Diff Tool | B+ | Section-aware diff is good; no three-way merge, no history |
| Insights / Statistics | B+ | Pure CSS charts are clever but limited vs recharts (already installed) |
| Content Search | C+ | O(n x fileSize) sequential download is a serious scalability gap |
| Ecosystem Integration | C+ | Three external tools wired as toast placeholders only |
| Testing | D | No test files anywhere |

---

### Detailed Improvement Recommendations

#### 1. Content Search - Replace the O(n) Download Scan

This is the most critical performance issue. The current implementation downloads every file from Object Storage on every search:

```
GET /api/inp-files/search/content?q=roughness
-> fetch 1,042 files from GCS
-> string.includes() each one
-> return matches
```

At 1,000+ files averaging ~500 KB each, this is ~500 MB of GCS reads per search query. It will either time out or cost significant GCS egress fees at scale.

The correct fix is a full-text search index in PostgreSQL. Add a `content` column or a dedicated `search_index` table:

```sql
-- Option A: Add tsvector column to inp_files
ALTER TABLE inp_files
ADD COLUMN content_tsv tsvector
GENERATED ALWAYS AS (to_tsvector('english', coalesce(content_text, ''))) STORED;

CREATE INDEX inp_files_content_tsv_idx
ON inp_files USING GIN (content_tsv);

-- Then search with:
SELECT id, filename, directory
FROM inp_files
WHERE content_tsv @@ plainto_tsquery('english', $1);
```

If storing raw content in PostgreSQL feels wrong (files can be large), use a separate `search_tokens` table storing pre-extracted key terms per file, populated asynchronously after upload:

```ts
// server/search-indexer.ts
export async function indexFileContent(
  fileId: string,
  content: string
): Promise<void> {
  const tokens = extractInpTokens(content);
  await db.insert(searchTokens).values(
    tokens.map((token) => ({ fileId, token: token.toLowerCase() }))
  );
}
```

This runs after upload completes (non-blocking) and enables sub-10ms search across the entire library.

---

#### 2. Wire the Three Placeholder Integrations

The FileCard "Open in Engine", "Open in INP MAKER", and "Run in BatchSWMM" actions show toast notifications instead of doing anything. These are the highest-value ecosystem connection points.

The pattern for all three is the same - pass file content via a deep-linked URL or `postMessage`:

```ts
// In FileCard.tsx - replace toast placeholders

async function handleOpenInEngine(file: InpFile) {
  const { fileContent } = await getInpFile(file.id);
  const key = `swmm-transfer-${Date.now()}`;
  sessionStorage.setItem(key, fileContent);
  window.open(
    `https://swmm-engine--robertdickinson.replit.app/?import=${key}&source=miner`,
    "_blank"
  );
}

async function handleOpenInInpMaker(file: InpFile) {
  const { fileContent } = await getInpFile(file.id);
  const encoded = encodeURIComponent(file.filename);
  const response = await fetch(
    `https://inp-maker--robertdickinson.replit.app/api/import`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: file.filename,
        content: fileContent,
        source: "swmm5-network-miner",
      }),
    }
  );
  const { sessionId } = await response.json();
  window.open(
    `https://inp-maker--robertdickinson.replit.app/?session=${sessionId}`,
    "_blank"
  );
}
```

Even if the target apps do not yet support the import endpoint, add the URL routing now so the button navigates to the correct app with the filename in the URL as a minimum viable integration.

---

#### 3. Replace Pure CSS Charts with Recharts

`recharts` is already installed but unused in Insights. The pure CSS bar charts and SVG donut work but have no interactivity beyond hover opacity. Switching to Recharts adds:

- Animated entry transitions
- Click-to-filter (clicking a diameter bin filters the file list)
- Proper axis labels and gridlines
- Responsive container (the CSS charts have fixed sizing)
- Tooltip with exact count + percentage

```tsx
// In Insights.tsx - replace BarChartViz with:
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell
} from "recharts";

function DiameterDistribution({ data }: { data: BinData[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ left: 0, right: 16 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
        />
        <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
        <Tooltip
          contentStyle={{
            background: "var(--card)",
            border: "1px solid var(--border)",
          }}
        />
        <Bar dataKey="count" radius={[3, 3, 0, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill="var(--primary)" opacity={0.8 + i * 0.02} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
```

---

#### 4. Persist Health Scores to Database

The AI health scoring runs client-side and results are discarded when the user navigates away. Add a `health_score` column to `inp_files`:

```sql
ALTER TABLE inp_files
ADD COLUMN health_score INTEGER,
ADD COLUMN health_analyzed_at TIMESTAMP,
ADD COLUMN health_errors INTEGER DEFAULT 0,
ADD COLUMN health_warnings INTEGER DEFAULT 0;
```

Then add a `POST /api/inp-files/:id/health-score` endpoint:

```ts
router.post("/api/inp-files/:id/health-score", async (req, res) => {
  const { score, errors, warnings } = req.body;
  await storage.updateHealthScore(req.params.id, {
    healthScore: score,
    healthErrors: errors,
    healthWarnings: warnings,
    healthAnalyzedAt: new Date(),
  });
  res.json({ success: true });
});
```

This enables:

- **Dashboard score badges** - show a colored dot on each FileCard without re-analyzing
- **Sort by health score** in the Dashboard (add "Health" to the sort dropdown)
- **Model Quality Leaderboard** - trivial once scores are persisted
- **Batch analysis results** that survive page reload

---

#### 5. Insights Cache - Replace Module Variable with Redis or PostgreSQL

The current 5-minute TTL cache is a module-level variable:

```ts
// Current - lost on server restart, not shared across workers
let insightsCache: InsightsData | null = null;
let cacheTime: number = 0;
```

This is fine for a single-process Replit deployment but breaks under any multi-process scenario and loses the cache on every deploy. Replace with a materialized PostgreSQL view or a cached database table:

```sql
CREATE TABLE insights_cache (
  computed_at TIMESTAMP NOT NULL DEFAULT NOW(),
  data JSONB NOT NULL
);

REFRESH MATERIALIZED VIEW insights_summary;
```

Alternatively, use a simple PostgreSQL-backed cache row with a `computed_at` timestamp check - same pattern as the current module variable but survives restarts.

---

#### 6. Model Version History / Diff Timeline

The `inp_files` table has `created_at` and `last_modified` but no version history. When a user saves edited content via `PUT /api/inp-files/:id/content`, the previous version is overwritten with no recovery path.

Add a `file_versions` table:

```sql
CREATE TABLE file_versions (
  id           VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id      VARCHAR NOT NULL REFERENCES inp_files(id) ON DELETE CASCADE,
  version_num  INTEGER NOT NULL,
  object_path  TEXT NOT NULL,
  node_count   INTEGER,
  link_count   INTEGER,
  size         INTEGER,
  created_at   TIMESTAMP NOT NULL DEFAULT NOW(),
  note         TEXT
);
```

The Compare page already has a diff algorithm - extend it to compare any two versions of the same file, creating a full change history view. This upgrades the tool from a file browser to a genuine model version control system.

---

#### 7. Minecraft Map - Add PNG Export and Click Popups

The Minecraft Map is already the most visually distinctive feature at ~1,136 LOC. Implementation path:

**PNG Export:**

```ts
// In MinecraftMap.tsx
function exportToPng() {
  const svgEl = svgRef.current;
  if (!svgEl) return;
  const svgData = new XMLSerializer().serializeToString(svgEl);
  const canvas = document.createElement("canvas");
  canvas.width = svgEl.clientWidth * 2;
  canvas.height = svgEl.clientHeight * 2;
  const ctx = canvas.getContext("2d")!;
  const img = new Image();
  img.onload = () => {
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const link = document.createElement("a");
    link.download = `${filename}-minecraft-map.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };
  img.src = `data:image/svg+xml;base64,${btoa(svgData)}`;
}
```

**Click Popups** (replacing the current title-attribute tooltip):

```tsx
const [popup, setPopup] = useState<{
  x: number; y: number; id: string; type: string; meta: string;
} | null>(null);

// In the SVG element handlers:
onClick={(e) => setPopup({
  x: e.clientX, y: e.clientY,
  id: node.id, type: "Junction",
  meta: `Elevation: ${node.elevation} ft`
})}
```

---

#### 8. Dashboard Filter Panel - Add Section-Based Filters

The current filters cover nodes, links, and subcatchments as numeric ranges. Add section-presence filters unique to a model library tool:

| Filter | Implementation |
| --- | --- |
| Has LID Controls | `[LID_CONTROLS]` section present in file |
| Has Pump Stations | `[PUMPS]` section with > 0 entries |
| Has Water Quality | `[POLLUTANTS]` section present |
| Has RDII | `[RDII]` section present |
| Routing Method | Parse `FLOW_ROUTING` from `[OPTIONS]` |
| Units | Parse `FLOW_UNITS` from `[OPTIONS]` (CFS/CMS) |

These require parsing more fields at upload time and storing them as columns or a JSONB `features` field on `inp_files`. Engineers searching for "all models with LID" or "all SI unit models" would use this constantly.

---

#### 9. Batch ReSWMM - Add Continuity Error Comparison

After running ReSWMM on a directory, automatically run both the original and discretized versions through the SWMM engine and compare:

Delta CE = CE_discretized - CE_original

A negative Delta CE means discretization improved numerical stability. Display this as a before/after table in the ReSWMM results panel. This is the primary engineering validation that discretization was beneficial.

---

#### 10. Testing - Zero Coverage on a 15,500-Line Codebase

Highest-value test targets:

```ts
// 1. INP parser - metadata counts must be exact
describe("parseInpFile", () => {
  it("counts junctions correctly from Greenville_US.inp", () => {
    const result = parseInpFile(greenvilleContent);
    expect(result.nodeCount).toBe(172);
  });
});

// 2. Health score formula - math must be stable
describe("analyzeInpFile", () => {
  it("scores 100 for a complete well-formed model", () => { ... });
  it("deducts 15 per error", () => { ... });
  it("clamps to 0 for catastrophically bad models", () => { ... });
});

// 3. ReSWMM discretization - conduit counts must be deterministic
describe("applyReswmm", () => {
  it("creates correct number of segments for fixed_interval method", () => {
    const result = applyReswmm(testInpContent, {
      method: "fixed_interval",
      fixedMinLength: 50,
      fixedMaxLength: 200,
    });
    expect(result.stats.newConduits).toBeGreaterThan(
      result.stats.originalConduits
    );
  });
});

// 4. Diff algorithm
describe("parseInpSections + diff", () => {
  it("detects added lines in [JUNCTIONS] section", () => { ... });
  it("reports hasChanges: false for identical files", () => { ... });
});
```

---

### Revised Priority Matrix

| Improvement | Impact | Effort | Priority |
| --- | --- | --- | --- |
| Full-text search index (replace O(n) scan) | Very High | Medium | 1 |
| Wire ecosystem integrations (Engine, INP Maker) | High | Low | 1 |
| Persist health scores to database | High | Low | 1 |
| Replace pure CSS charts with Recharts | High | Low | 1 |
| Section-based dashboard filters | High | Medium | 2 |
| File version history table | High | Medium | 2 |
| Minecraft map PNG export + click popups | Medium | Low | 2 |
| Insights cache to PostgreSQL | Medium | Low | 2 |
| Batch ReSWMM + CE comparison | High | Medium | 3 |
| INP parser + health score tests | High | Low | 3 |
| Multi-theme extension (add more universities) | Low | Low | 4 |
| Subcatchment delineation from GIS | Very High | Very High | 4 |

### Revised Score After Top 4 Improvements

Implementing the content search index, ecosystem wiring, health score persistence, and Recharts upgrade would move the score to approximately **A / 95-96**, matching the top tier of the suite.
