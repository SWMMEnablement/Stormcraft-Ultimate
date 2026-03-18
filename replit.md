# SWMMCRAFT Ultimate

## Overview

SWMMCRAFT Ultimate is a web-based SWMM (Storm Water Management Model) visualization and simulation tool with a Minecraft-inspired pixel art aesthetic. It allows users to design drainage networks by placing nodes (junctions, outfalls, storage units, rain gauges), connecting them with conduits, and running hydraulic simulations using a real Manning's equation-based routing engine. The app features a guided tutorial with an animated "Steve" character, challenge levels with budget constraints, project save/load via a database, and import/export of standard SWMM `.inp` files.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend (React + Vite)
- **Framework**: React with TypeScript, bundled by Vite
- **Routing**: Uses `wouter` for client-side routing (single page app with `/` as the main route)
- **State Management**: Local React state in the `Home` page component manages the entire SWMM model, simulation state, tutorial progress, budget, and challenge level. React Query (`@tanstack/react-query`) handles server-state for project CRUD operations.
- **UI Components**: Shadcn/ui component library (new-york style) with Radix UI primitives. Custom SWMM-specific components live in `client/src/components/SWMM/`.
- **Styling**: Tailwind CSS v4 (via `@tailwindcss/vite` plugin) with CSS variables for theming. Minecraft-inspired pixel fonts (`Press Start 2P`, `VT323`) from Google Fonts.
- **Canvas Rendering**: The map view uses HTML5 Canvas (`<canvas>`) for 2D rendering. A Three.js WebGL 3D view (`ThreeCanvas.tsx`) provides a Minecraft-style block-based visualization with OrbitControls, animated water, day/night cycle, rain particles, and an animated Steve character walking conduit paths. Toggle between 2D/3D via the toolbar. Nodes are colored by invert elevation (blue→cyan→green→yellow→red heatmap), pipes are thicker and colored by average elevation, and subcatchments render as blue translucent polygons colored by area size.
- **Sound**: Web Audio API generates Minecraft-style sound effects (clicks, plops) programmatically — no audio files needed.

### Key Frontend Modules
- `client/src/lib/swmm-types.ts` — Core type definitions for the SWMM model (Node, Link, Subcatchment, etc.)
- `client/src/lib/steve.ts` — Steve character AI, movement, speech generation, and pixel art rendering
- `client/src/lib/tutorial.ts` — Step-by-step tutorial system
- `client/src/lib/budget.ts` — Budget tracking and cost calculations for challenge mode
- `client/src/lib/challenges.ts` — Challenge level definitions with increasing difficulty
- `client/src/lib/swmm-engine.ts` — Real hydraulic simulation engine with Manning's equation, topological routing, and kinematic wave approximation
- `client/src/lib/inp-parser.ts` — Parser for SWMM `.inp` file format (including XSECTIONS for pipe diameters)
- `client/src/lib/swmm-export.ts` — Generator for SWMM `.inp` file export (with proper XSECTIONS diameter export)
- `client/src/lib/demo-models.ts` — Demo model definitions including small examples and the Greenville Complete model
- `client/src/lib/greenville-model.json` — Parsed Greenville, SC SWMM model (172 nodes, 223 links, 30 subcatchments)
- `client/src/lib/api.ts` — Typed fetch wrappers for the REST API
- `client/src/lib/sound.ts` — Web Audio synthesized sound effects

### Backend (Express + Node.js)
- **Runtime**: Node.js with Express, written in TypeScript and run via `tsx`
- **API**: RESTful JSON API under `/api/projects` supporting full CRUD (GET, POST, PATCH, DELETE)
- **Validation**: Zod schemas generated from Drizzle table definitions via `drizzle-zod`
- **Dev Server**: Vite dev server middleware is injected into Express during development for HMR
- **Production**: Client is built to `dist/public`, server is bundled with esbuild to `dist/index.cjs`

### Data Storage
- **Database**: PostgreSQL via `pg` (node-postgres) connection pool
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema**: Single `projects` table with columns: `id` (UUID, auto-generated), `name`, `description`, `modelData` (JSONB storing the full SWMM model state), `createdAt`, `updatedAt`
- **Migrations**: Managed via `drizzle-kit push` command (`npm run db:push`)
- **Storage Pattern**: `IStorage` interface in `server/storage.ts` with `DatabaseStorage` implementation, making it straightforward to swap storage backends

### Build System
- **Development**: `npm run dev` starts the Express server with Vite middleware for HMR
- **Production Build**: `npm run build` runs a custom build script (`script/build.ts`) that builds the client with Vite and the server with esbuild, bundling select dependencies to reduce cold start times
- **Path Aliases**: `@/` maps to `client/src/`, `@shared/` maps to `shared/`, `@assets/` maps to `attached_assets/`

### API Structure
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects` | List all projects |
| GET | `/api/projects/:id` | Get single project |
| POST | `/api/projects` | Create new project |
| PATCH | `/api/projects/:id` | Update project |
| DELETE | `/api/projects/:id` | Delete project |

The model data (nodes, links, subcatchments) is stored as a single JSONB blob in the `modelData` column rather than normalized into separate tables. This simplifies the schema since the model is always loaded/saved as a whole.

## External Dependencies

### Database
- **PostgreSQL** — Required. Connection string must be provided via `DATABASE_URL` environment variable. Used for persistent project storage.

### Key NPM Packages
- **Drizzle ORM + drizzle-zod** — Database ORM and schema-to-validation bridge
- **Express** — HTTP server framework
- **@tanstack/react-query** — Server state management on the client
- **Radix UI / shadcn** — Accessible UI component primitives
- **three** — 3D rendering engine for the Minecraft-style WebGL view
- **wouter** — Lightweight client-side router
- **Vite** — Frontend build tool and dev server
- **esbuild** — Server bundler for production builds
- **connect-pg-simple** — PostgreSQL session store (available but sessions not actively used in current routes)

### External Services
- **Google Fonts** — `Press Start 2P` and `VT323` fonts loaded via CDN
- **Replit Plugins** — `@replit/vite-plugin-runtime-error-modal`, `@replit/vite-plugin-cartographer`, `@replit/vite-plugin-dev-banner` for Replit-specific dev experience (conditionally loaded)

### Environment Variables
- `DATABASE_URL` — PostgreSQL connection string (required)
- `NODE_ENV` — Controls dev vs production behavior