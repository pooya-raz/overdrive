# Overdrive

A digital implementation of the **Overdrive** racing board game. This monorepo contains the backend game engine, API, and frontend client for managing game state, player actions, and turn-based racing mechanics.

## Tech Stack

- **Runtime:** Cloudflare Workers + Durable Objects (serverless edge computing with stateful coordination)
- **Framework:** [Hono](https://hono.dev/) (lightweight TypeScript web framework)
- **Language:** TypeScript (strict mode)
- **Testing:** Vitest
- **Linting:** Biome
- **Frontend:** React + Vite
- **Styling:** Tailwind CSS
- **UI Components:** Shadcn

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm (recommended) or npm

### Installation

```bash
pnpm install
```

### Development

```bash
pnpm run dev
```

This starts:
- Backend at http://localhost:8787
- Frontend at http://localhost:5173

## Project Structure

```
packages/
├── shared/               # Shared TypeScript types (@overdrive/shared)
│   └── src/
│       ├── game.ts       # Game types (GameState, PlayerData, Action, etc.)
│       └── lobby.ts      # Lobby types (RoomInfo, RoomState, etc.)
├── backend/              # Cloudflare Workers backend
│   └── src/
│       ├── index.ts      # Hono server entry point
│       ├── game-room.ts  # Room logic (pure business logic)
│       ├── game-room-do.ts # Durable Object wrapper
│       ├── lobby.ts      # Lobby Durable Object
│       └── engine/
│           ├── game.ts   # Core game state & turn management
│           ├── player.ts # Player class & card mechanics
│           └── *.test.ts # Test files
└── frontend/             # React frontend (Cloudflare Pages)
    └── src/
        ├── components/   # React components
        └── hooks/        # Custom hooks (WebSocket)
```

## Development

### Commands

| Command | Description |
|---------|-------------|
| `pnpm run dev` | Start both backend and frontend dev servers |
| `pnpm run dev:backend` | Start backend dev server only |
| `pnpm run dev:frontend` | Start frontend dev server only |
| `pnpm run test` | Run backend unit tests (Vitest) |
| `pnpm run e2e` | Run end-to-end tests (Playwright) |
| `pnpm run e2e:ui` | Run E2E tests with Playwright UI |
| `pnpm run verify` | Run linter and tests |
| `pnpm run deploy` | Deploy both backend and frontend |
| `pnpm run deploy:backend` | Deploy backend to Cloudflare Workers |
| `pnpm run deploy:frontend` | Deploy frontend to Cloudflare Pages |

### Cloudflare Bindings

When using Cloudflare bindings, pass them as generics:

```ts
const app = new Hono<{ Bindings: CloudflareBindings }>()
```

## Testing

### Unit Tests (Vitest)

Backend unit tests are colocated with source files (`*.test.ts`)

```bash
pnpm run test
```

### End-to-End Tests (Playwright)

E2E tests in `e2e/` directory test full user flows through the frontend

```bash
pnpm run e2e        # Run E2E tests headless
pnpm run e2e:ui     # Run with Playwright UI for debugging
```

## Deployment

The application deploys to Cloudflare's edge network:

- **Backend:** Cloudflare Workers + Durable Objects
- **Frontend:** Cloudflare Pages

### Prerequisites

1. A Cloudflare account
2. Wrangler CLI authenticated: `npx wrangler login`

### Deploy Commands

```bash
pnpm run deploy            # Deploy both backend and frontend
pnpm run deploy:backend    # Deploy backend only
pnpm run deploy:frontend   # Deploy frontend only
```

### Backend (Workers + Durable Objects)

The backend uses two Durable Objects for stateful coordination:

- **Lobby:** Manages game room listings and player matchmaking
- **GameRoomDO:** Handles individual game state and WebSocket connections

Configuration is in `packages/backend/wrangler.jsonc`.

### Frontend (Pages)

The frontend builds to static assets and deploys to Cloudflare Pages. The deploy command builds the frontend and uploads to the `overdrive` Pages project.

## License

MIT
