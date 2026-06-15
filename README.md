# SWMMCRAFT Ultimate

A web-based SWMM modeling, visualization, and simulation environment with a Minecraft-inspired interface, built to make drainage system design more interactive, visual, and accessible while still supporting real EPA SWMM execution and standard `.inp` workflows. [1]

## Overview

SWMMCRAFT Ultimate is a browser application for creating and exploring stormwater and drainage networks using familiar SWMM concepts such as nodes, links, subcatchments, and simulation results. It combines a game-like visual style with engineering-oriented functionality, including project save/load, standard SWMM file import/export, guided tutorials, challenge modes, and a full results viewer. 

The repository is public in the `SWMMEnablement` organization and currently serves as the code base for the linked Replit deployment. The repo currently has no published releases or packages, and GitHub shows TypeScript as the dominant language, followed by HTML and CSS. [1]

## Why this project matters

This project sits at the intersection of engineering software, education, and visual communication. It helps make SWMM-based thinking more intuitive by allowing users to build systems directly on a canvas, inspect them visually in 2D or 3D, and connect design decisions to hydraulic outcomes. 

That makes it useful for several audiences:
- Stormwater and wastewater modelers who want a fast visual sandbox for concepts and prototype networks. 
- Students and trainees who benefit from tutorial guidance and a more approachable interface than traditional engineering tools. 
- Developers exploring browser-based infrastructure modeling workflows using modern web technologies. 

## Core capabilities

### Network creation and editing
Users can place multiple SWMM object types directly on an interactive canvas, including junctions, outfalls, storage units, and rain gauges. They can then connect those elements with conduits and define subcatchments with routing information and hydrologic properties. 

The interface is designed around direct manipulation rather than form-heavy setup, which makes it easier to explore layout ideas quickly. The visual system also colors nodes by invert elevation using a heatmap-style ramp from blue through red, helping users read grade patterns at a glance. 

### Simulation workflows
The application supports two complementary simulation paths. A browser-side hydraulic engine provides fast feedback using Manning-based calculations and a kinematic-wave-style approximation, while the backend can run the compiled EPA SWMM 5.1.13 engine for more authoritative model execution and report generation. 

The `/api/simulate` endpoint accepts model input, runs SWMM, and returns the raw report output. The results interface can then present analysis views as well as the raw `.RPT` and `.INP` text so users can inspect both interpreted and original outputs. 

### Standard SWMM file support
SWMMCRAFT Ultimate supports import and export of standard SWMM `.inp` files, including handling of XSECTIONS information for pipe diameter data. That makes the app more than a closed demonstration environment, because users can move data into and out of established SWMM workflows. 

Bundled demo models are included as starting points, including a parsed Greenville, South Carolina model with 172 nodes, 223 links, and 30 subcatchments. The repository also includes an `attached_assets` folder with additional example drainage models for testing. [1]

### Tutorial and challenge modes
The project includes a guided tutorial system and an animated “Steve” character that supports user onboarding. This makes the application easier to approach for newer users and adds personality to the interface. 

Challenge levels introduce increasing difficulty and budget constraints, turning the model-building experience into a structured design exercise. That game mechanic can help reinforce tradeoffs between design intent, cost, and performance. 

### 2D and 3D visualization
The main editing experience uses HTML5 Canvas for 2D rendering, but the application also includes a Three.js WebGL view that presents the model in a Minecraft-style 3D environment. This 3D view includes animated water, rain particles, a day/night cycle, and Steve walking along conduit paths. 

The presence of both 2D and 3D views is a strong differentiator for the project. It supports both engineering clarity and visual engagement, which is especially helpful for teaching, demos, and stakeholder-facing exploration. 

### Snapshots and comparison
A dedicated snapshot panel allows users to save, restore, and compare model states. Snapshot comparisons include difference statistics and engineering metrics, and the data is persisted locally in browser storage. 

That feature is especially useful for iterative design work, where a user may want to compare alternatives such as different conduit sizes, storage placement, or subcatchment routing decisions. 

## Technical architecture

### Frontend
The frontend uses React with TypeScript and Vite, with `wouter` for client-side routing and `@tanstack/react-query` for server-state interactions such as project CRUD operations. UI components are built with shadcn/ui and Radix primitives, and styling is handled with Tailwind CSS and CSS variables. 

Key frontend logic is organized in the `client/src/lib` area, including files for model types, the hydraulic engine, tutorial logic, challenge rules, budget handling, file parsing/export, sound generation, and API helpers. SWMM-specific user interface components live under `client/src/components/SWMM/`. [1]

### Backend
The backend is a TypeScript Express application running on Node.js. It exposes a REST API under `/api/projects` for CRUD operations and a simulation endpoint for running the SWMM executable and returning report content. 

In development, Vite middleware is injected into Express for a unified app workflow. In production, the client is built into `dist/public` and the server is bundled to `dist/index.cjs`. 

### Database and storage
Persistent project storage is backed by PostgreSQL using Drizzle ORM. The schema stores project metadata and the complete model state in a JSONB `modelData` column rather than splitting the model into many relational tables. 

That storage choice is practical for this type of application because the model is usually saved and loaded as a whole object graph. The storage layer is also abstracted behind an `IStorage` interface, which should make alternate implementations easier later. 

## API summary

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/projects` | List all saved projects.  |
| `GET` | `/api/projects/:id` | Retrieve a single saved project.  |
| `POST` | `/api/projects` | Create a new project record.  |
| `PATCH` | `/api/projects/:id` | Update an existing project.  |
| `DELETE` | `/api/projects/:id` | Delete a project.  |
| `POST` | `/api/simulate` | Run the SWMM5 engine and return raw simulation output.  |

## Repository structure

```text
Stormcraft-Ultimate/
├── .agents/                  # Assessment and handover notes [page:1]
├── attached_assets/          # Example drainage models for testing [page:1]
├── client/                   # React frontend [page:1][cite:2]
├── script/                   # Build scripts [page:1]
├── server/                   # Express backend and SWMM integration [page:1][cite:2]
├── shared/                   # Shared types/schemas across client and server [page:1][cite:2]
├── HANDOVER.md               # Handover and improvement plan [page:1]
├── drizzle.config.ts         # Drizzle configuration [page:1]
├── package.json              # Project scripts and dependencies [page:1]
├── replit.md                 # Architecture and system notes [page:1][cite:2]
├── tsconfig.json             # TypeScript configuration [page:1]
└── vite.config.ts            # Vite configuration [page:1]
```

## Key implementation highlights

Several implementation choices stand out:
- Real SWMM integration through a compiled EPA SWMM 5.1.13 binary, not just a visual mockup. 
- A browser-side hydraulic preview engine for rapid feedback during editing. 
- A full results viewer that exposes both analyzed summaries and the original report/input text. 
- A mobile-responsive design with hamburger navigation, touch-friendly controls, and slide-in overlays for smaller screens. 
- A distinct visual identity built around Minecraft-inspired rendering, fonts, sounds, and animated scene elements. 

Together, those choices make the app feel more like a serious modeling tool wrapped in a teaching and exploration interface, rather than a simple novelty visualization. 

## Getting started

### Prerequisites
- Node.js installed locally. 
- A PostgreSQL database available through a `DATABASE_URL` connection string. 

### Typical setup

```bash
git clone https://github.com/SWMMEnablement/Stormcraft-Ultimate.git
cd Stormcraft-Ultimate
npm install
```

Set the required environment variable:

```bash
export DATABASE_URL="postgresql://user:password@host:5432/database"
```

Apply the schema and start the development server:

```bash
npm run db:push
npm run dev
```

The documented development flow uses Express with Vite middleware for hot reload. Production builds use a custom script that outputs the client bundle and a bundled Node server. 

## Suggested README badges

These badge ideas fit the current repository well:
- TypeScript
- React
- Vite
- PostgreSQL
- EPA SWMM 5.1.13
- Replit app link
- License badge once the repository license file is added

GitHub currently shows the repository as public with no releases, no packages, and no existing README. Adding badges plus a strong project summary should improve first impressions substantially. [1]

## Suggested future README additions

Once the project matures a little further, these sections would strengthen the repo even more:
- Screenshots or animated GIFs for the 2D editor, 3D view, and results panels.
- A short “Quick Start” modeling walkthrough using one bundled demo model.
- A “How SWMM execution works” section with details on `.inp` generation, engine execution, and `.rpt` parsing.
- A contributor guide explaining architecture conventions and where to extend node/link/subcatchment logic.
- A roadmap section listing simulation, UI, and collaboration improvements.

## Copy-ready short description

SWMMCRAFT Ultimate is a browser-based SWMM modeling and visualization environment that combines real EPA SWMM 5.1.13 execution, interactive network editing, standard `.inp` import/export, guided tutorials, challenge modes, and Minecraft-style 2D/3D rendering for drainage system design and exploration. 

## Copy-ready README starter

If you want a shorter version for GitHub, this compact block works well:

```md
# SWMMCRAFT Ultimate

A browser-based SWMM modeling and visualization app with a Minecraft-inspired interface, real EPA SWMM 5.1.13 execution, 2D/3D network views, `.inp` import/export, guided tutorials, challenge levels, and project save/load support.

## Features
- Interactive drainage network editing
- EPA SWMM5 simulation support
- `.inp` import/export
- 2D canvas and 3D Three.js visualization
- Snapshot comparison tools
- Guided tutorial and challenge modes
- PostgreSQL-backed saved projects

## Stack
React, TypeScript, Vite, Express, PostgreSQL, Drizzle ORM, Three.js, Tailwind CSS, shadcn/ui.
```
