# Show Opponent Played Cards During Resolution

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Issue:** https://github.com/pooya-raz/overdrive/issues/8

**Goal:** Show opponent played cards and action choices during resolution phase with live updates.

**Architecture:** Add `TurnActions` to shared types and `PlayerData`. Backend populates it on each action dispatch. Frontend shows `TurnSummary` component when watching another player's turn.

**Tech Stack:** TypeScript, React, Vitest

---

## Task 1: Add TurnActions type to shared types

**Files:**
- Modify: `packages/shared/src/game.ts:37-45`

**Step 1: Add TurnActions interface after ReactChoice type**

Add after line 37 (`export type ReactChoice = ...`):

```typescript
export interface TurnActions {
	adrenaline?: { acceptMove: boolean; acceptCooldown: boolean };
	react?: { action: ReactChoice; amount?: number };
	slipstream?: { used: boolean };
	discard?: { count: number };
}
```

**Step 2: Add turnActions field to PlayerData**

Add after `played: Card[];` (line 55):

```typescript
	turnActions: TurnActions;
```

**Step 3: Verify types compile**

Run: `cd packages/shared && pnpm exec tsc --noEmit`
Expected: Compilation errors in backend (Player class doesn't return turnActions yet)

**Step 4: Commit**

```bash
git add packages/shared/src/game.ts
git commit -m "feat: add TurnActions type to shared types"
```

---

## Task 2: Add turnActions to Player class state

**Files:**
- Modify: `packages/backend/src/engine/player.ts:148-169`

**Step 1: Add private field for turnActions**

Add after line 107 (`private _availableReactions: ("cooldown" | "boost")[];`):

```typescript
	private _turnActions: TurnActions;
```

**Step 2: Initialize turnActions in constructor**

Add after line 140 (`this._availableReactions = [];`):

```typescript
		this._turnActions = {};
```

**Step 3: Add turnActions to state getter**

In the `get state()` method, add after `finished: this._finished,` (line 167):

```typescript
			turnActions: structuredClone(this._turnActions),
```

**Step 4: Add import for TurnActions**

Update the import from "./types" (line 1-11) to include `TurnActions`:

```typescript
import type {
	Card,
	Corner,
	Done,
	GameMap,
	Gear,
	PlayerData,
	ReactChoice,
	ShuffleFn,
	TurnActions,
} from "./types";
```

**Step 5: Verify types compile**

Run: `cd packages/backend && pnpm exec tsc --noEmit`
Expected: Success (types now match)

**Step 6: Run existing tests**

Run: `pnpm run test`
Expected: All tests pass

**Step 7: Commit**

```bash
git add packages/backend/src/engine/player.ts
git commit -m "feat: add turnActions field to Player state"
```

---

## Task 3: Record adrenaline action in turnActions

**Files:**
- Modify: `packages/backend/src/engine/player.ts:376-386`
- Test: `packages/backend/src/engine/game-engine.test.ts`

**Step 1: Write failing test**

Add to `game-engine.test.ts` after the adrenaline describe block (around line 436):

```typescript
	describe("turnActions tracking", () => {
		it("should record adrenaline choice in turnActions", () => {
			const game = new Game(
				{ players: [PLAYER_1, PLAYER_2], map: "USA" },
				{ shuffle: noShuffle },
			);

			// P1 moves 0, P2 moves more to give P1 adrenaline next turn
			game.dispatch(PLAYER_1.id, { type: "plan", gear: 1, cardIndices: [5] });
			game.dispatch(PLAYER_2.id, { type: "plan", gear: 2, cardIndices: [6, 4] });
			completeResolutionPhase(game);

			// Turn 2: P1 has adrenaline
			expect(game.state.players[PLAYER_1.id].hasAdrenaline).toBe(true);
			game.dispatch(PLAYER_1.id, { type: "plan", gear: 1, cardIndices: [4] });
			game.dispatch(PLAYER_2.id, { type: "plan", gear: 1, cardIndices: [3] });

			// P2 resolves first (leader)
			game.dispatch(PLAYER_2.id, { type: "move" });
			game.dispatch(PLAYER_2.id, { type: "react", action: "skip" });
			game.dispatch(PLAYER_2.id, { type: "discard", cardIndices: [] });

			// P1 resolves - accept +1 move from adrenaline
			game.dispatch(PLAYER_1.id, { type: "move" });
			game.dispatch(PLAYER_1.id, {
				type: "adrenaline",
				acceptMove: true,
				acceptCooldown: false,
			});

			expect(game.state.players[PLAYER_1.id].turnActions.adrenaline).toEqual({
				acceptMove: true,
				acceptCooldown: false,
			});
		});
	});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test -- --grep "should record adrenaline choice"`
Expected: FAIL - turnActions.adrenaline is undefined

**Step 3: Implement recording in applyAdrenaline**

Modify `applyAdrenaline` method in `player.ts` (around line 376):

```typescript
	applyAdrenaline(acceptMove: boolean, acceptCooldown: boolean): void {
		this._turnActions.adrenaline = { acceptMove, acceptCooldown };
		if (!this._hasAdrenaline) {
			return;
		}
		if (acceptMove) {
			this.addAdrenalineMove();
		}
		if (acceptCooldown) {
			this.addCooldown(1);
		}
	}
```

**Step 4: Run test to verify it passes**

Run: `pnpm run test -- --grep "should record adrenaline choice"`
Expected: PASS

**Step 5: Run all tests**

Run: `pnpm run test`
Expected: All tests pass

**Step 6: Commit**

```bash
git add packages/backend/src/engine/player.ts packages/backend/src/engine/game-engine.test.ts
git commit -m "feat: record adrenaline action in turnActions"
```

---

## Task 4: Record react action in turnActions

**Files:**
- Modify: `packages/backend/src/engine/player.ts:388-437`
- Test: `packages/backend/src/engine/game-engine.test.ts`

**Step 1: Write failing test**

Add to the `turnActions tracking` describe block:

```typescript
		it("should record react choice in turnActions", () => {
			const game = new Game(
				{ players: [PLAYER_1], map: "USA" },
				{ shuffle: noShuffle },
			);

			game.dispatch(PLAYER_1.id, { type: "plan", gear: 1, cardIndices: [6] });
			game.dispatch(PLAYER_1.id, { type: "move" });
			game.dispatch(PLAYER_1.id, {
				type: "adrenaline",
				acceptMove: false,
				acceptCooldown: false,
			});
			game.dispatch(PLAYER_1.id, { type: "react", action: "skip" });

			expect(game.state.players[PLAYER_1.id].turnActions.react).toEqual({
				action: "skip",
			});
		});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test -- --grep "should record react choice"`
Expected: FAIL - turnActions.react is undefined

**Step 3: Implement recording in react method**

Modify `react` method in `player.ts`. Add at the start of the method (after line 388):

```typescript
	react(action: ReactChoice): Done {
		this._turnActions.react = { action };
		if (action !== "skip" && !this._availableReactions.includes(action)) {
```

Note: We record every react action. If boost is used, we'll update with amount later.

**Step 4: Record boost amount when boost is used**

In the `case "boost":` block, after calculating `speedBonus` (around line 419), update turnActions:

```typescript
				if (drawn) {
					const speedBonus = drawn.value ?? 0;
					this._turnActions.react = { action: "boost", amount: speedBonus };
					this._position += speedBonus;
```

**Step 5: Run test to verify it passes**

Run: `pnpm run test -- --grep "should record react choice"`
Expected: PASS

**Step 6: Write test for boost amount**

Add to the `turnActions tracking` describe block:

```typescript
		it("should record boost amount in turnActions", () => {
			const game = new Game(
				{ players: [PLAYER_1], map: "USA" },
				{ shuffle: noShuffle },
			);

			game.dispatch(PLAYER_1.id, { type: "plan", gear: 1, cardIndices: [6] });
			game.dispatch(PLAYER_1.id, { type: "move" });
			game.dispatch(PLAYER_1.id, {
				type: "adrenaline",
				acceptMove: false,
				acceptCooldown: false,
			});
			game.dispatch(PLAYER_1.id, { type: "react", action: "boost" });

			// With noShuffle, boost draws from top of deck
			// Amount varies based on what's drawn, but should be recorded
			expect(game.state.players[PLAYER_1.id].turnActions.react?.action).toBe("boost");
			expect(typeof game.state.players[PLAYER_1.id].turnActions.react?.amount).toBe("number");
		});
```

**Step 7: Run all turnActions tests**

Run: `pnpm run test -- --grep "turnActions"`
Expected: All pass

**Step 8: Commit**

```bash
git add packages/backend/src/engine/player.ts packages/backend/src/engine/game-engine.test.ts
git commit -m "feat: record react action in turnActions"
```

---

## Task 5: Record slipstream action in turnActions

**Files:**
- Modify: `packages/backend/src/engine/game.ts:234-244`
- Test: `packages/backend/src/engine/game-engine.test.ts`

**Step 1: Write failing test**

Add to the `turnActions tracking` describe block:

```typescript
		it("should record slipstream choice in turnActions", () => {
			const game = new Game(
				{ players: [PLAYER_1, PLAYER_2], map: "USA" },
				{ shuffle: noShuffle },
			);

			// Both move same distance to enable slipstream for P2
			game.dispatch(PLAYER_1.id, { type: "plan", gear: 1, cardIndices: [6] });
			game.dispatch(PLAYER_2.id, { type: "plan", gear: 1, cardIndices: [6] });

			// P1 resolves first
			game.dispatch(PLAYER_1.id, { type: "move" });
			game.dispatch(PLAYER_1.id, { type: "react", action: "skip" });
			game.dispatch(PLAYER_1.id, { type: "discard", cardIndices: [] });

			// P2 resolves - can slipstream because P1 at same position
			game.dispatch(PLAYER_2.id, { type: "move" });
			game.dispatch(PLAYER_2.id, {
				type: "adrenaline",
				acceptMove: false,
				acceptCooldown: false,
			});
			game.dispatch(PLAYER_2.id, { type: "react", action: "skip" });
			game.dispatch(PLAYER_2.id, { type: "slipstream", use: true });

			expect(game.state.players[PLAYER_2.id].turnActions.slipstream).toEqual({
				used: true,
			});
		});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test -- --grep "should record slipstream choice"`
Expected: FAIL - turnActions.slipstream is undefined

**Step 3: Implement recording in slipstream handler**

Modify `handleResolutionAction` in `game.ts`, `case "slipstream":` (around line 234):

```typescript
			case "slipstream": {
				player.recordSlipstream(action.use);
				if (action.use) {
```

**Step 4: Add recordSlipstream method to Player**

Add to `player.ts` after the `react` method:

```typescript
	recordSlipstream(used: boolean): void {
		this._turnActions.slipstream = { used };
	}
```

**Step 5: Run test to verify it passes**

Run: `pnpm run test -- --grep "should record slipstream choice"`
Expected: PASS

**Step 6: Run all tests**

Run: `pnpm run test`
Expected: All tests pass

**Step 7: Commit**

```bash
git add packages/backend/src/engine/game.ts packages/backend/src/engine/player.ts packages/backend/src/engine/game-engine.test.ts
git commit -m "feat: record slipstream action in turnActions"
```

---

## Task 6: Record discard action in turnActions

**Files:**
- Modify: `packages/backend/src/engine/player.ts:234-253`
- Test: `packages/backend/src/engine/game-engine.test.ts`

**Step 1: Write failing test**

Add to the `turnActions tracking` describe block:

```typescript
		it("should record discard count in turnActions", () => {
			const game = new Game(
				{ players: [PLAYER_1], map: "USA" },
				{ shuffle: noShuffle },
			);

			game.dispatch(PLAYER_1.id, { type: "plan", gear: 1, cardIndices: [6] });
			game.dispatch(PLAYER_1.id, { type: "move" });
			game.dispatch(PLAYER_1.id, {
				type: "adrenaline",
				acceptMove: false,
				acceptCooldown: false,
			});
			game.dispatch(PLAYER_1.id, { type: "react", action: "skip" });
			// Discard 2 cards (indices 4 and 5 are upgrade cards, discardable)
			game.dispatch(PLAYER_1.id, { type: "discard", cardIndices: [4, 5] });

			// After discard, we're in next turn - check state captured the count
			// Note: turnActions clears on new turn, so we need a different approach
			// Actually, let's check right before discard completes turn transition
		});
```

Wait - the discard action triggers the turn transition. Let me revise:

**Step 1 (revised): Write failing test**

```typescript
		it("should record discard count in turnActions", () => {
			const game = new Game(
				{ players: [PLAYER_1, PLAYER_2], map: "USA" },
				{ shuffle: noShuffle },
			);

			game.dispatch(PLAYER_1.id, { type: "plan", gear: 1, cardIndices: [6] });
			game.dispatch(PLAYER_2.id, { type: "plan", gear: 1, cardIndices: [6] });

			// P1 resolves first
			game.dispatch(PLAYER_1.id, { type: "move" });
			game.dispatch(PLAYER_1.id, { type: "react", action: "skip" });
			// Discard 2 cards
			game.dispatch(PLAYER_1.id, { type: "discard", cardIndices: [3, 4] });

			// P1's turn is done, P2's turn starts - but P1's turnActions should persist until new planning phase
			expect(game.state.players[PLAYER_1.id].turnActions.discard).toEqual({
				count: 2,
			});
		});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test -- --grep "should record discard count"`
Expected: FAIL - turnActions.discard is undefined

**Step 3: Implement recording in discard method**

Modify `discard` method in `player.ts` (around line 234). Add at start:

```typescript
	discard(discardIndices: number[]): void {
		this._turnActions.discard = { count: discardIndices.length };
		const sortedIndices = [...discardIndices].sort((a, b) => b - a);
```

**Step 4: Run test to verify it passes**

Run: `pnpm run test -- --grep "should record discard count"`
Expected: PASS

**Step 5: Run all tests**

Run: `pnpm run test`
Expected: All tests pass

**Step 6: Commit**

```bash
git add packages/backend/src/engine/player.ts packages/backend/src/engine/game-engine.test.ts
git commit -m "feat: record discard action in turnActions"
```

---

## Task 7: Clear turnActions on new turn

**Files:**
- Modify: `packages/backend/src/engine/player.ts`
- Modify: `packages/backend/src/engine/game.ts:261-269`
- Test: `packages/backend/src/engine/game-engine.test.ts`

**Step 1: Write failing test**

Add to the `turnActions tracking` describe block:

```typescript
		it("should clear turnActions when new turn begins", () => {
			const game = new Game(
				{ players: [PLAYER_1], map: "USA" },
				{ shuffle: noShuffle },
			);

			// Complete turn 1
			game.dispatch(PLAYER_1.id, { type: "plan", gear: 1, cardIndices: [6] });
			game.dispatch(PLAYER_1.id, { type: "move" });
			game.dispatch(PLAYER_1.id, {
				type: "adrenaline",
				acceptMove: true,
				acceptCooldown: false,
			});
			game.dispatch(PLAYER_1.id, { type: "react", action: "skip" });
			game.dispatch(PLAYER_1.id, { type: "discard", cardIndices: [] });

			// Now in turn 2 planning phase
			expect(game.state.turn).toBe(2);
			expect(game.state.players[PLAYER_1.id].turnActions).toEqual({});
		});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test -- --grep "should clear turnActions when new turn"`
Expected: FAIL - turnActions still has values from previous turn

**Step 3: Add clearTurnActions method to Player**

Add to `player.ts`:

```typescript
	clearTurnActions(): void {
		this._turnActions = {};
	}
```

**Step 4: Call clearTurnActions when transitioning to planning**

In `game.ts`, in the `case "discard":` block where we transition to planning phase (around line 262), add:

```typescript
				this.assignAdrenaline();
				for (const p of Object.values(this._state.players)) {
					p.clearTurnActions();
				}
				this._state.phase = "planning";
```

**Step 5: Run test to verify it passes**

Run: `pnpm run test -- --grep "should clear turnActions when new turn"`
Expected: PASS

**Step 6: Run all tests**

Run: `pnpm run test`
Expected: All tests pass

**Step 7: Commit**

```bash
git add packages/backend/src/engine/player.ts packages/backend/src/engine/game.ts packages/backend/src/engine/game-engine.test.ts
git commit -m "feat: clear turnActions on new turn"
```

---

## Task 8: Export TurnActions from backend types

**Files:**
- Modify: `packages/backend/src/engine/types.ts`

**Step 1: Add TurnActions to re-exports**

Update imports in `types.ts`:

```typescript
// Re-export shared types
export type {
	Action,
	Card,
	CardType,
	Corner,
	GameMap,
	GamePhase,
	GameState,
	Gear,
	PlayerData,
	ReactChoice,
	Track,
	TurnActions,
	TurnState,
} from "@overdrive/shared";
```

**Step 2: Verify types compile**

Run: `pnpm run verify`
Expected: Success

**Step 3: Commit**

```bash
git add packages/backend/src/engine/types.ts
git commit -m "chore: export TurnActions from backend types"
```

---

## Task 9: Create TurnSummary component

**Files:**
- Create: `packages/frontend/src/components/TurnSummary.tsx`

**Step 1: Create the component**

```typescript
import type { PlayerData, TurnState } from "@overdrive/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { PlayedCards } from "./PlayedCards";

interface TurnSummaryProps {
	player: PlayerData;
	currentState: TurnState;
}

const phases: TurnState[] = ["move", "adrenaline", "react", "slipstream", "discard"];

function getPhaseDisplay(
	phase: TurnState,
	currentState: TurnState,
	player: PlayerData,
): { status: "pending" | "current" | "done"; label: string } {
	const phaseIndex = phases.indexOf(phase);
	const currentIndex = phases.indexOf(currentState);

	if (phaseIndex > currentIndex) {
		return { status: "pending", label: "" };
	}

	if (phaseIndex === currentIndex) {
		return { status: "current", label: "" };
	}

	// Phase is done - get result
	const { turnActions } = player;

	switch (phase) {
		case "move":
			return { status: "done", label: "✓" };

		case "adrenaline": {
			const adr = turnActions.adrenaline;
			if (!adr || (!adr.acceptMove && !adr.acceptCooldown)) {
				return { status: "done", label: "✗" };
			}
			const parts: string[] = [];
			if (adr.acceptMove) parts.push("+1 move");
			if (adr.acceptCooldown) parts.push("+1 cool");
			return { status: "done", label: parts.join(", ") };
		}

		case "react": {
			const react = turnActions.react;
			if (!react || react.action === "skip") {
				return { status: "done", label: "✗" };
			}
			if (react.action === "boost" && react.amount !== undefined) {
				return { status: "done", label: `boost +${react.amount}` };
			}
			return { status: "done", label: react.action };
		}

		case "slipstream": {
			const slip = turnActions.slipstream;
			if (!slip || !slip.used) {
				return { status: "done", label: "✗" };
			}
			return { status: "done", label: "✓" };
		}

		case "discard": {
			const disc = turnActions.discard;
			if (!disc || disc.count === 0) {
				return { status: "done", label: "✗" };
			}
			return { status: "done", label: `${disc.count}` };
		}

		default:
			return { status: "done", label: "✓" };
	}
}

export function TurnSummary({ player, currentState }: TurnSummaryProps) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>{player.username || player.id}'s Turn</CardTitle>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="flex items-center gap-4">
					<PlayedCards cards={player.played} />
					<span className="text-muted-foreground">
						Speed: <span className="font-bold text-foreground">{player.speed}</span>
					</span>
				</div>

				<div className="grid grid-cols-5 gap-1 text-center text-sm">
					{phases.map((phase) => {
						const { status, label } = getPhaseDisplay(phase, currentState, player);
						return (
							<div
								key={phase}
								className={cn(
									"py-2 px-1 rounded border",
									status === "current" && "border-blue-500 bg-blue-500/10",
									status === "done" && "border-muted bg-muted/50",
									status === "pending" && "border-transparent",
								)}
							>
								<div className="font-medium capitalize">{phase}</div>
								<div className="text-muted-foreground h-5">
									{status === "current" ? "..." : label}
								</div>
							</div>
						);
					})}
				</div>
			</CardContent>
		</Card>
	);
}
```

**Step 2: Verify types compile**

Run: `cd packages/frontend && pnpm exec tsc --noEmit`
Expected: Success

**Step 3: Commit**

```bash
git add packages/frontend/src/components/TurnSummary.tsx
git commit -m "feat: add TurnSummary component"
```

---

## Task 10: Integrate TurnSummary into Game component

**Files:**
- Modify: `packages/frontend/src/components/Game.tsx`

**Step 1: Import TurnSummary**

Add import at top of file:

```typescript
import { TurnSummary } from "./TurnSummary";
```

**Step 2: Replace waiting message with TurnSummary**

In `Game.tsx`, find the else block that shows "Waiting for..." (around line 111-125). Replace:

```typescript
									) : (
										<Card>
											<CardContent className="py-6 text-center text-muted-foreground">
												<Badge variant="secondary" className="text-base px-4 py-1">
													{gameState.phase}
												</Badge>
												<p className="mt-3">
													Waiting for{" "}
													{gameState.phase === "planning"
														? "other players..."
														: `${currentTurnPlayerName}...`}
												</p>
											</CardContent>
										</Card>
									)}
```

With:

```typescript
									) : gameState.phase === "resolution" && currentTurnPlayer ? (
										<TurnSummary
											player={gameState.players[currentTurnPlayer]}
											currentState={gameState.currentState}
										/>
									) : (
										<Card>
											<CardContent className="py-6 text-center text-muted-foreground">
												<Badge variant="secondary" className="text-base px-4 py-1">
													{gameState.phase}
												</Badge>
												<p className="mt-3">
													Waiting for other players...
												</p>
											</CardContent>
										</Card>
									)}
```

**Step 3: Verify types compile**

Run: `cd packages/frontend && pnpm exec tsc --noEmit`
Expected: Success

**Step 4: Run verify**

Run: `pnpm run verify`
Expected: All checks pass

**Step 5: Commit**

```bash
git add packages/frontend/src/components/Game.tsx
git commit -m "feat: integrate TurnSummary into Game component"
```

---

## Task 11: Manual E2E verification

**Step 1: Start dev server**

Run: `pnpm run dev`

**Step 2: Test in browser**

1. Open two browser windows
2. Create a game with both players
3. Both players submit plans
4. Verify: When Player 1 is resolving, Player 2 sees TurnSummary with:
   - Player 1's played cards
   - Phase timeline with current phase highlighted
   - As Player 1 acts, phases update with results

**Step 3: Run E2E tests**

Run: `pnpm run e2e`
Expected: All E2E tests pass

**Step 4: Final commit (if any fixes needed)**

---

## Summary

This plan implements opponent played cards display during resolution:

1. **Tasks 1-2**: Add `TurnActions` type and integrate into `PlayerData`
2. **Tasks 3-7**: Record each action type in `turnActions` with tests
3. **Task 8**: Export types properly
4. **Tasks 9-10**: Create and integrate `TurnSummary` component
5. **Task 11**: Manual verification
