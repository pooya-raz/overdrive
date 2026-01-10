# CLAUDE.md - Overdrive

## Project Overview

Monorepo for the digital implementation of the "Overdrive" racing board game. Contains backend (Cloudflare Workers with Hono), frontend (React), and shared types.

## Tech Stack

- **Runtime:** Cloudflare Workers + Durable Objects
- **Framework:** Hono (TypeScript)
- **Testing:** Vitest
- **Linting:** Biome
- **Package Manager:** pnpm (always use pnpm, not npm)

## Commands

```bash
pnpm run dev      # Start local dev server
pnpm run test     # Run unit tests (use during development)
pnpm run e2e      # Run E2E tests (Playwright)
pnpm run verify   # Lint + test (use before committing)
pnpm run deploy   # Deploy to Cloudflare
```

## Project Structure

```
src/
├── index.ts              # Hono server entry point
└── engine/
    ├── game-engine.ts    # Game state, phases, turn management
    ├── game-engine.test.ts
    ├── player.ts         # Player class, card mechanics
    └── player.test.ts
```

## Development Principles

### A Philosophy of Software Design
Follow the principles from John Ousterhout's "A Philosophy of Software Design":
- Design deep modules with simple interfaces
- Define errors out of existence
- Pull complexity downward
- Write obvious code
- Avoid shallow abstractions

### Development Workflow
1. **Structure first:** Write code structure with comments on interfaces and public methods, using empty/stub return values
2. **Tests second:** Write tests against the interface
3. **Implementation last:** Fill in the implementation

## Key Patterns

### Dependency Injection for Testing
The `Player` class accepts a `shuffle` function for deterministic testing:
```typescript
new Player({ shuffle: myDeterministicShuffle })
```

### Immutable State Access
Game state is returned via `structuredClone` to prevent external mutations.

### Turn-Based Dispatch
Central `dispatch(playerId, action)` method validates actions and advances phases when all players have acted.

### Phase Progression
`shift` → `playCards` → (auto: `move`) → `discardAndReplenish` → next turn

## Game Mechanics

- **Gears:** 1-4 (shifting by 2 costs 1 heat card)
- **Hand size:** 7 cards
- **Card types:** Speed (1-4), Heat (0), Stress (0), Upgrade (0,5)
- **Movement:** Sum of played card values

## Testing Conventions

### Unit Tests (Vitest)
- Tests colocated with source (`*.test.ts`)
- Use deterministic shuffle injection for predictable tests
- Non-null assertions (`!`) allowed in test files (Biome override)
- Engine tests (`game-engine.test.ts`) should only test through the `Game` class interface, never instantiate encapsulated classes like `Player` directly

### E2E Tests (Playwright)
- E2E tests in `e2e/` directory (`*.spec.ts`)
- Test full user flows through the frontend
- Run with `pnpm run e2e` or `pnpm run e2e:ui` for debugging

## Code Style

- Strict TypeScript
- Descriptive variable names
- Explicit error messages
- No unnecessary comments (only for non-obvious logic)
- Avoid nested if statements (use early returns, continue, or extract methods)

## Commits

Do not add co-author line to commits.
