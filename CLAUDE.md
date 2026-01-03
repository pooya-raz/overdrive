# CLAUDE.md - Heat Backend

## Project Overview

Digital implementation of the "Heat: Pedal to the Metal" racing board game. Turn-based game engine running on Cloudflare Workers with Hono framework.

## Tech Stack

- **Runtime:** Cloudflare Workers
- **Framework:** Hono (TypeScript)
- **Testing:** Vitest
- **Linting:** Biome
- **Package Manager:** pnpm

## Commands

```bash
pnpm run dev      # Start local dev server
pnpm run test     # Run tests
pnpm run lint     # Lint and auto-fix
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

- Tests colocated with source (`*.test.ts`)
- Use deterministic shuffle injection for predictable tests
- Non-null assertions (`!`) allowed in test files (Biome override)

## Code Style

- Strict TypeScript
- Descriptive variable names
- Explicit error messages
- No unnecessary comments (only for non-obvious logic)
