# Delay Position Update Until Move Confirmation

## Problem

When a player enters the "move" state, their car animates to the new position immediately—before they click the "Move" button. This makes the confirmation feel pointless.

## Solution

Delay the position update until the player confirms by dispatching `{ type: "move" }`.

### Current flow

1. `revealAndMove()` calls `player.beginResolution()`
2. `beginResolution()` calculates speed AND updates `_position`
3. Game state becomes "move"
4. Frontend receives new position → car animates
5. Player clicks "Move" (but car already moved)

### New flow

1. `revealAndMove()` calls `player.beginResolution()`
2. `beginResolution()` calculates speed, stores `_startPosition`, but does NOT update `_position`
3. Game state becomes "move"
4. Frontend shows car at original position with calculated speed displayed
5. Player clicks "Move"
6. Position updated to `_startPosition + _cardSpeed`
7. Frontend animates the move

## Implementation

### 1. `player.ts` - Remove position update from `beginResolution()`

Remove this line from `beginResolution()`:
```typescript
this._position = this._startPosition + this._cardSpeed;
```

### 2. `player.ts` - Add `confirmMove()` method

```typescript
confirmMove(): void {
  this._position = this._startPosition + this._cardSpeed;
}
```

### 3. `game.ts` - Call `confirmMove()` in move action handler

In the `case "move":` block, call `player.confirmMove()` before transitioning state.

## Files to modify

- `packages/backend/src/engine/player.ts`
- `packages/backend/src/engine/game.ts`
- `packages/backend/src/engine/game-engine.test.ts` (update affected tests)
