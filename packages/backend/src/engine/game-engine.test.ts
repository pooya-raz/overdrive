import { describe, expect, it } from "vitest";
import {
	type CreateGameRequest,
	Game,
	type PlayerInput,
	type ShuffleFn,
} from "./game";

const PLAYER_1: PlayerInput = { id: "p1", username: "Alice" };
const PLAYER_2: PlayerInput = { id: "p2", username: "Bob" };
const PLAYER_3: PlayerInput = { id: "p3", username: "Carol" };
const PLAYER_4: PlayerInput = { id: "p4", username: "Dave" };
const PLAYER_5: PlayerInput = { id: "p5", username: "Eve" };

const noShuffle: ShuffleFn = <T>(items: T[]) => items;

/** Helper to complete resolution phase for all players in turn order */
function completeResolutionPhase(game: Game): void {
	// Players resolve in turn order (leader first), one at a time
	for (const playerId of game.state.turnOrder) {
		game.dispatch(playerId, { type: "move" });
		// Adrenaline is skipped when not available
		if (game.state.currentState === "adrenaline") {
			game.dispatch(playerId, {
				type: "adrenaline",
				acceptMove: false,
			});
		}
		game.dispatch(playerId, { type: "react", action: "skip" });
		// Slipstream is skipped when not available
		if (game.state.currentState === "slipstream") {
			game.dispatch(playerId, { type: "slipstream", use: false });
		}
		// Corner penalty acknowledgment is required when penalties are paid
		if (game.state.currentState === "cornerPenalty") {
			game.dispatch(playerId, { type: "cornerPenalty" });
		}
		game.dispatch(playerId, { type: "discard", cardIndices: [] });
	}
}

describe("Game", () => {
	describe("initialization", () => {
		it("should create a game with players on turn 1", () => {
			const request: CreateGameRequest = {
				players: [PLAYER_1, PLAYER_2],
				map: "USA",
			};

			const game = new Game(request, { shuffle: noShuffle });

			expect(game.state.turn).toBe(1);
			expect(game.state.phase).toBe("planning");
			expect(game.state.currentState).toBe("plan");
			expect(game.state.pendingPlayers).toEqual({
				[PLAYER_1.id]: true,
				[PLAYER_2.id]: true,
			});

			for (const { id } of request.players) {
				const player = game.state.players[id];
				expect(player.gear).toBe(1);
				expect(player.engineSize).toBe(6);
				expect(player.discardSize).toBe(0);
				// With noShuffle, hand is last 7 cards from deck (popped from end)
				expect(player.hand).toEqual([
					{ type: "stress" },
					{ type: "stress" },
					{ type: "stress" },
					{ type: "heat" },
					{ type: "upgrade", value: 5 },
					{ type: "upgrade", value: 0 },
					{ type: "speed", value: 4 },
				]);
				expect(player.deckSize).toBe(11);
			}
			expect(game.state.map).toBe("USA");
		});

		it("should reject duplicate player UUIDs", () => {
			const request: CreateGameRequest = {
				players: [PLAYER_1, PLAYER_1],
				map: "USA",
			};

			expect(() => new Game(request)).toThrow("Player IDs must be unique");
		});

		it("should shuffle deck at game start", () => {
			const hands: string[] = [];

			for (let i = 0; i < 10; i++) {
				const game = new Game({
					players: [PLAYER_1],
					map: "USA",
				});
				hands.push(JSON.stringify(game.state.players[PLAYER_1.id].hand));
			}

			const uniqueHands = new Set(hands);
			expect(uniqueHands.size).toBeGreaterThan(1);
		});

		it("includes player usernames in game state", () => {
			const game = new Game({
				players: [
					{ id: PLAYER_1.id, username: "Alice" },
					{ id: PLAYER_2.id, username: "Bob" },
				],
				map: "USA",
			});
			const state = game.getStateForPlayer(PLAYER_1.id);
			expect(state.players[PLAYER_1.id].username).toBe("Alice");
			expect(state.players[PLAYER_2.id].username).toBe("Bob");
		});
	});

	describe("dispatch", () => {
		describe("validation", () => {
			it("should reject action for wrong state", () => {
				const game = new Game(
					{
						players: [PLAYER_1],
						map: "USA",
					},
					{ shuffle: noShuffle },
				);

				// Submit plan to enter resolution phase
				game.dispatch(PLAYER_1.id, { type: "plan", gear: 1, cardIndices: [6] });

				// Now in resolution phase (move acknowledgment), plan action should be rejected
				expect(() =>
					game.dispatch(PLAYER_1.id, {
						type: "plan",
						gear: 2,
						cardIndices: [5],
					}),
				).toThrow("Invalid action for state move");
			});

			it("should reject action for unknown player", () => {
				const game = new Game(
					{
						players: [PLAYER_1],
						map: "USA",
					},
					{ shuffle: noShuffle },
				);

				expect(() =>
					game.dispatch("unknown-player-id", {
						type: "plan",
						gear: 2,
						cardIndices: [6, 5],
					}),
				).toThrow("Player not found");
			});

			it("should reject action if player already acted", () => {
				const game = new Game(
					{
						players: [PLAYER_1, PLAYER_2],
						map: "USA",
					},
					{ shuffle: noShuffle },
				);

				game.dispatch(PLAYER_1.id, {
					type: "plan",
					gear: 2,
					cardIndices: [6, 5],
				});

				expect(() =>
					game.dispatch(PLAYER_1.id, {
						type: "plan",
						gear: 3,
						cardIndices: [4, 3, 2],
					}),
				).toThrow("Player has already acted this state");
			});
		});

		describe("state transitions", () => {
			it("should mark player as acted after action", () => {
				const game = new Game(
					{
						players: [PLAYER_1, PLAYER_2],
						map: "USA",
					},
					{ shuffle: noShuffle },
				);

				game.dispatch(PLAYER_1.id, {
					type: "plan",
					gear: 2,
					cardIndices: [6, 5],
				});

				expect(game.state.pendingPlayers).toEqual({
					[PLAYER_1.id]: false,
					[PLAYER_2.id]: true,
				});
			});

			it("should enter resolution phase when all players submit plan", () => {
				const game = new Game(
					{
						players: [PLAYER_1, PLAYER_2],
						map: "USA",
					},
					{ shuffle: noShuffle },
				);

				game.dispatch(PLAYER_1.id, {
					type: "plan",
					gear: 2,
					cardIndices: [6, 5],
				});
				game.dispatch(PLAYER_2.id, {
					type: "plan",
					gear: 2,
					cardIndices: [6, 5],
				});

				expect(game.state.turn).toBe(1);
				expect(game.state.phase).toBe("resolution");
				// First player must acknowledge move
				expect(game.state.currentState).toBe("move");

				for (const id of [PLAYER_1.id, PLAYER_2.id]) {
					const player = game.state.players[id];
					expect(player.gear).toBe(2);
					expect(player.engineSize).toBe(6);
					expect(player.discardSize).toBe(0);
					expect(player.hand).toHaveLength(5); // 7 - 2 played
					expect(player.deckSize).toBe(11);
				}
			});

			it("should not update position until move is confirmed", () => {
				const game = new Game(
					{
						players: [PLAYER_1],
						map: "USA",
					},
					{ shuffle: noShuffle },
				);

				// Player starts at position 0, plays speed 4 card
				const startPosition = game.state.players[PLAYER_1.id].position;
				game.dispatch(PLAYER_1.id, { type: "plan", gear: 1, cardIndices: [6] });

				// After planning, in "move" state, position should NOT have changed yet
				expect(game.state.currentState).toBe("move");
				expect(game.state.players[PLAYER_1.id].position).toBe(startPosition);
				expect(game.state.players[PLAYER_1.id].speed).toBe(4);

				// After confirming move, position should update
				game.dispatch(PLAYER_1.id, { type: "move" });
				expect(game.state.players[PLAYER_1.id].position).toBe(
					startPosition + 4,
				);
			});

			it("should advance to next turn after resolution phase completes", () => {
				const game = new Game(
					{
						players: [PLAYER_1],
						map: "USA",
					},
					{ shuffle: noShuffle },
				);

				// Planning phase - gear 1 means play 1 card
				game.dispatch(PLAYER_1.id, { type: "plan", gear: 1, cardIndices: [6] });

				// Resolution phase - player must acknowledge move first
				expect(game.state.currentState).toBe("move");
				game.dispatch(PLAYER_1.id, { type: "move" });

				// Single player has adrenaline (they're in last place)
				expect(game.state.currentState).toBe("adrenaline");
				game.dispatch(PLAYER_1.id, {
					type: "adrenaline",
					acceptMove: false,
				});
				game.dispatch(PLAYER_1.id, { type: "react", action: "skip" });
				// Slipstream is skipped (single player has no one to slipstream)
				expect(game.state.currentState).toBe("discard");
				game.dispatch(PLAYER_1.id, { type: "discard", cardIndices: [] });

				// After all resolution states, should be back to planning phase turn 2
				expect(game.state.turn).toBe(2);
				expect(game.state.phase).toBe("planning");
				expect(game.state.currentState).toBe("plan");
			});
		});
	});

	describe("adrenaline", () => {
		it("should assign adrenaline to trailing player at game start", () => {
			const game = new Game(
				{
					players: [PLAYER_1, PLAYER_2],
					map: "USA",
				},
				{ shuffle: noShuffle },
			);

			// P1 at position 0 on raceline (leader), P2 at position 0 off raceline (trailing)
			expect(game.state.players[PLAYER_1.id].hasAdrenaline).toBe(false);
			expect(game.state.players[PLAYER_2.id].hasAdrenaline).toBe(true);
		});

		it("should give adrenaline to last position player after resolution", () => {
			const game = new Game(
				{
					players: [PLAYER_1, PLAYER_2],
					map: "USA",
				},
				{ shuffle: noShuffle },
			);

			// Player 1: gear 2, speed 4 + upgrade 0 = 4 movement
			// Player 2: gear 1, speed 4 = 4 movement
			// With noShuffle, hand[6] = speed 4, hand[5] = upgrade 0
			game.dispatch(PLAYER_1.id, {
				type: "plan",
				gear: 2,
				cardIndices: [6, 5],
			});
			game.dispatch(PLAYER_2.id, { type: "plan", gear: 1, cardIndices: [6] });

			// Complete resolution phase
			completeResolutionPhase(game);

			// After resolution: adrenaline assigned to trailing player
			expect(game.state.phase).toBe("planning");

			const p1Adrenaline = game.state.players[PLAYER_1.id].hasAdrenaline;
			const p2Adrenaline = game.state.players[PLAYER_2.id].hasAdrenaline;
			// At least one should have it (the one in last or tied for last)
			expect(p1Adrenaline || p2Adrenaline).toBe(true);
		});

		it("should give adrenaline to player with lower position", () => {
			const game = new Game(
				{
					players: [PLAYER_1, PLAYER_2],
					map: "USA",
				},
				{ shuffle: noShuffle },
			);

			// Player 1: gear 1, upgrade 0 (0 movement) - index 5
			// Player 2: gear 2, speed 4 + upgrade 5 = 9 movement - indices 6, 4
			game.dispatch(PLAYER_1.id, { type: "plan", gear: 1, cardIndices: [5] });
			game.dispatch(PLAYER_2.id, {
				type: "plan",
				gear: 2,
				cardIndices: [6, 4],
			});

			// Complete resolution phase
			completeResolutionPhase(game);

			// Player 1 at position 0, Player 2 at position 9
			// Player 1 (lower position) should have adrenaline
			expect(game.state.players[PLAYER_1.id].hasAdrenaline).toBe(true);
			expect(game.state.players[PLAYER_2.id].hasAdrenaline).toBe(false);
		});

		it("should give adrenaline to last 2 players in 5+ player game", () => {
			const game = new Game(
				{
					players: [PLAYER_1, PLAYER_2, PLAYER_3, PLAYER_4, PLAYER_5],
					map: "USA",
				},
				{ shuffle: noShuffle },
			);

			// Player 1: upgrade 0 = 0 movement
			// Player 2: upgrade 0 = 0 movement
			// Player 3: speed 4 = 4 movement
			// Player 4: speed 4 = 4 movement
			// Player 5: speed 4 = 4 movement
			game.dispatch(PLAYER_1.id, { type: "plan", gear: 1, cardIndices: [5] });
			game.dispatch(PLAYER_2.id, { type: "plan", gear: 1, cardIndices: [5] });
			game.dispatch(PLAYER_3.id, { type: "plan", gear: 1, cardIndices: [6] });
			game.dispatch(PLAYER_4.id, { type: "plan", gear: 1, cardIndices: [6] });
			game.dispatch(PLAYER_5.id, { type: "plan", gear: 1, cardIndices: [6] });

			// Complete resolution phase
			completeResolutionPhase(game);

			// Players 1 and 2 at position 0 (tied for last)
			// They should both have adrenaline
			expect(game.state.players[PLAYER_1.id].hasAdrenaline).toBe(true);
			expect(game.state.players[PLAYER_2.id].hasAdrenaline).toBe(true);
			expect(game.state.players[PLAYER_3.id].hasAdrenaline).toBe(false);
			expect(game.state.players[PLAYER_4.id].hasAdrenaline).toBe(false);
			expect(game.state.players[PLAYER_5.id].hasAdrenaline).toBe(false);
		});

		it("should keep adrenaline available during resolution phase", () => {
			const game = new Game(
				{
					players: [PLAYER_1, PLAYER_2],
					map: "USA",
				},
				{ shuffle: noShuffle },
			);

			// Complete turn 1
			game.dispatch(PLAYER_1.id, { type: "plan", gear: 1, cardIndices: [5] });
			game.dispatch(PLAYER_2.id, {
				type: "plan",
				gear: 2,
				cardIndices: [6, 4],
			});
			completeResolutionPhase(game);

			// Verify adrenaline was assigned after turn 1
			expect(game.state.turn).toBe(2);
			expect(game.state.players[PLAYER_1.id].hasAdrenaline).toBe(true);

			// After entering resolution, adrenaline should still be available
			game.dispatch(PLAYER_1.id, { type: "plan", gear: 1, cardIndices: [4] });
			game.dispatch(PLAYER_2.id, { type: "plan", gear: 1, cardIndices: [3] });

			// Now in resolution phase, adrenaline should still be available
			expect(game.state.phase).toBe("resolution");
			expect(game.state.players[PLAYER_1.id].hasAdrenaline).toBe(true);
			expect(game.state.players[PLAYER_2.id].hasAdrenaline).toBe(false);
		});
	});

	describe("turnActions tracking", () => {
		it("should record adrenaline choice in turnActions", () => {
			const game = new Game(
				{ players: [PLAYER_1, PLAYER_2], map: "USA" },
				{ shuffle: noShuffle },
			);

			// P1 moves 0, P2 moves more to give P1 adrenaline next turn
			game.dispatch(PLAYER_1.id, { type: "plan", gear: 1, cardIndices: [5] });
			game.dispatch(PLAYER_2.id, {
				type: "plan",
				gear: 2,
				cardIndices: [6, 4],
			});
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
			});

			expect(game.state.players[PLAYER_1.id].turnActions.adrenaline).toEqual({
				acceptMove: true,
			});
		});

		it("should auto-apply cooldown when declining adrenaline move", () => {
			const game = new Game(
				{ players: [PLAYER_1, PLAYER_2], map: "USA" },
				{ shuffle: noShuffle },
			);

			// P1 moves 0, P2 moves more to give P1 adrenaline next turn
			game.dispatch(PLAYER_1.id, { type: "plan", gear: 1, cardIndices: [5] });
			game.dispatch(PLAYER_2.id, {
				type: "plan",
				gear: 2,
				cardIndices: [6, 4],
			});
			completeResolutionPhase(game);

			// Turn 2: P1 has adrenaline
			expect(game.state.players[PLAYER_1.id].hasAdrenaline).toBe(true);
			game.dispatch(PLAYER_1.id, { type: "plan", gear: 1, cardIndices: [4] });
			game.dispatch(PLAYER_2.id, { type: "plan", gear: 1, cardIndices: [3] });

			// P2 resolves first (leader)
			game.dispatch(PLAYER_2.id, { type: "move" });
			game.dispatch(PLAYER_2.id, { type: "react", action: "skip" });
			game.dispatch(PLAYER_2.id, { type: "discard", cardIndices: [] });

			// P1 resolves - decline +1 move but should still get cooldown
			game.dispatch(PLAYER_1.id, { type: "move" });
			// P1 in gear 1 gets 3 cooldowns from beginResolution
			expect(game.state.players[PLAYER_1.id].availableCooldowns).toBe(3);

			game.dispatch(PLAYER_1.id, {
				type: "adrenaline",
				acceptMove: false,
			});

			// Cooldown should be auto-applied even when declining move (+1 from adrenaline)
			expect(game.state.players[PLAYER_1.id].availableCooldowns).toBe(4);
		});

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
			});
			game.dispatch(PLAYER_1.id, { type: "react", action: "skip" });

			expect(game.state.players[PLAYER_1.id].turnActions.react).toEqual({
				action: "skip",
			});
		});

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
			});
			game.dispatch(PLAYER_1.id, { type: "react", action: "boost" });

			// With noShuffle, boost draws from top of deck
			// Amount varies based on what's drawn, but should be recorded
			expect(game.state.players[PLAYER_1.id].turnActions.react?.action).toBe(
				"boost",
			);
			expect(
				typeof game.state.players[PLAYER_1.id].turnActions.react?.amount,
			).toBe("number");
		});

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
			});
			game.dispatch(PLAYER_2.id, { type: "react", action: "skip" });
			game.dispatch(PLAYER_2.id, { type: "slipstream", use: true });

			expect(game.state.players[PLAYER_2.id].turnActions.slipstream).toEqual({
				used: true,
			});
		});

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
			// Discard 2 cards (upgrade cards at indices 4 and 5 after playing card 6)
			game.dispatch(PLAYER_1.id, { type: "discard", cardIndices: [4, 5] });

			// P1's turn is done, P2's turn starts - but P1's turnActions should persist until new planning phase
			expect(game.state.players[PLAYER_1.id].turnActions.discard).toEqual({
				count: 2,
			});
		});

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
			});
			game.dispatch(PLAYER_1.id, { type: "react", action: "skip" });
			game.dispatch(PLAYER_1.id, { type: "discard", cardIndices: [] });

			// Now in turn 2 planning phase
			expect(game.state.turn).toBe(2);
			expect(game.state.players[PLAYER_1.id].turnActions).toEqual({});
		});
	});

	describe("position collision", () => {
		it("should assign raceline to first player arriving at position", () => {
			const game = new Game(
				{
					players: [PLAYER_1, PLAYER_2],
					map: "USA",
				},
				{ shuffle: noShuffle },
			);

			// Both players: gear 1, speed 4 = 4 movement
			game.dispatch(PLAYER_1.id, { type: "plan", gear: 1, cardIndices: [6] });
			game.dispatch(PLAYER_2.id, { type: "plan", gear: 1, cardIndices: [6] });

			// Complete resolution phase
			completeResolutionPhase(game);

			// Both end at position 4, first in turn order (PLAYER_1) gets raceline
			expect(game.state.players[PLAYER_1.id].position).toBe(4);
			expect(game.state.players[PLAYER_1.id].onRaceline).toBe(true);
			expect(game.state.players[PLAYER_2.id].position).toBe(4);
			expect(game.state.players[PLAYER_2.id].onRaceline).toBe(false);

			//Player 2 should get adrenaline
			expect(game.state.players[PLAYER_2.id].hasAdrenaline).toBe(true);
			expect(game.state.players[PLAYER_1.id].hasAdrenaline).toBe(false);
		});

		it("should cascade third player back when position is full", () => {
			const game = new Game(
				{
					players: [PLAYER_1, PLAYER_2, PLAYER_3],
					map: "USA",
				},
				{ shuffle: noShuffle },
			);

			// P1, P2 at position 0: speed 4 → position 4
			// P3 at position -1: speed 5 → targets position 4, cascades to 3
			game.dispatch(PLAYER_1.id, { type: "plan", gear: 1, cardIndices: [6] });
			game.dispatch(PLAYER_2.id, { type: "plan", gear: 1, cardIndices: [6] });
			game.dispatch(PLAYER_3.id, { type: "plan", gear: 1, cardIndices: [4] }); // Upgrade5

			// Complete resolution phase
			completeResolutionPhase(game);

			// Position 4 is full (P1 on raceline, P2 off), P3 cascades to position 3
			expect(game.state.players[PLAYER_1.id].position).toBe(4);
			expect(game.state.players[PLAYER_1.id].onRaceline).toBe(true);
			expect(game.state.players[PLAYER_2.id].position).toBe(4);
			expect(game.state.players[PLAYER_2.id].onRaceline).toBe(false);
			expect(game.state.players[PLAYER_3.id].position).toBe(3);
			expect(game.state.players[PLAYER_3.id].onRaceline).toBe(true);
		});

		it("should cascade multiple positions when all are full", () => {
			const game = new Game(
				{
					players: [PLAYER_1, PLAYER_2, PLAYER_3, PLAYER_4, PLAYER_5],
					map: "USA",
				},
				{ shuffle: noShuffle },
			);

			// All five players: gear 1, speed 4 = 4 movement
			for (const id of [
				PLAYER_1.id,
				PLAYER_2.id,
				PLAYER_3.id,
				PLAYER_4.id,
				PLAYER_5.id,
			]) {
				game.dispatch(id, { type: "plan", gear: 1, cardIndices: [6] });
			}

			// Complete resolution phase
			completeResolutionPhase(game);

			// P1, P2 at position 4; P3, P4 at position 3; P5 at position 2
			expect(game.state.players[PLAYER_1.id].position).toBe(4);
			expect(game.state.players[PLAYER_2.id].position).toBe(4);
			expect(game.state.players[PLAYER_3.id].position).toBe(3);
			expect(game.state.players[PLAYER_4.id].position).toBe(3);
			expect(game.state.players[PLAYER_5.id].position).toBe(2);
		});
	});

	describe("slipstream", () => {
		it("should allow slipstream when car is at same position", () => {
			const game = new Game(
				{
					players: [PLAYER_1, PLAYER_2],
					map: "USA",
				},
				{ shuffle: noShuffle },
			);

			// Both players move same distance → end at position 4
			game.dispatch(PLAYER_1.id, { type: "plan", gear: 1, cardIndices: [6] });
			game.dispatch(PLAYER_2.id, { type: "plan", gear: 1, cardIndices: [6] });

			// P1 resolves first - must acknowledge move
			expect(game.state.currentState).toBe("move");
			game.dispatch(PLAYER_1.id, { type: "move" });
			// P1 is leader, no adrenaline, goes to react
			// P2 hasn't moved yet (still at 0), so P1 can't slipstream
			expect(game.state.currentState).toBe("react");
			game.dispatch(PLAYER_1.id, { type: "react", action: "skip" });
			// Slipstream skipped (P2 at original position 0)
			expect(game.state.currentState).toBe("discard");
			game.dispatch(PLAYER_1.id, { type: "discard", cardIndices: [] });

			// P2 resolves - must acknowledge move first
			expect(game.state.currentState).toBe("move");
			game.dispatch(PLAYER_2.id, { type: "move" });
			// P2 has adrenaline (trailing player at game start)
			expect(game.state.currentState).toBe("adrenaline");
			game.dispatch(PLAYER_2.id, {
				type: "adrenaline",
				acceptMove: false,
			});
			// P2 can slipstream because P1 is at same position
			game.dispatch(PLAYER_2.id, { type: "react", action: "skip" });
			expect(game.state.currentState).toBe("slipstream");
			game.dispatch(PLAYER_2.id, { type: "slipstream", use: true });
			game.dispatch(PLAYER_2.id, { type: "discard", cardIndices: [] });

			// P2 moved from 4 to 6 via slipstream (+2 spaces)
			expect(game.state.players[PLAYER_1.id].position).toBe(4);
			expect(game.state.players[PLAYER_2.id].position).toBe(4 + 2);
		});

		it("should allow slipstream when car is 1 space ahead", () => {
			const game = new Game(
				{
					players: [PLAYER_1, PLAYER_2],
					map: "USA",
				},
				{ shuffle: noShuffle },
			);

			// P1: upgrade 5 = 5 movement → position 5
			// P2: speed 4 = 4 movement → position 4
			game.dispatch(PLAYER_1.id, { type: "plan", gear: 1, cardIndices: [4] });
			game.dispatch(PLAYER_2.id, { type: "plan", gear: 1, cardIndices: [6] });

			// P1 resolves first - acknowledge move
			expect(game.state.currentState).toBe("move");
			game.dispatch(PLAYER_1.id, { type: "move" });
			// P1 is leader, no adrenaline, goes to react
			// P2 hasn't moved yet (still at 0), so P1 can't slipstream
			expect(game.state.currentState).toBe("react");
			game.dispatch(PLAYER_1.id, { type: "react", action: "skip" });
			// Slipstream skipped (P2 at original position 0)
			expect(game.state.currentState).toBe("discard");
			game.dispatch(PLAYER_1.id, { type: "discard", cardIndices: [] });

			// P2 resolves - acknowledge move
			expect(game.state.currentState).toBe("move");
			game.dispatch(PLAYER_2.id, { type: "move" });
			// P2 at position 4, P1 at position 5 (1 ahead) - can slipstream
			// P2 has adrenaline (trailing player at game start)
			expect(game.state.currentState).toBe("adrenaline");
			game.dispatch(PLAYER_2.id, {
				type: "adrenaline",
				acceptMove: false,
			});
			game.dispatch(PLAYER_2.id, { type: "react", action: "skip" });
			expect(game.state.currentState).toBe("slipstream");
			game.dispatch(PLAYER_2.id, { type: "slipstream", use: true });
			game.dispatch(PLAYER_2.id, { type: "discard", cardIndices: [] });

			expect(game.state.players[PLAYER_1.id].position).toBe(5);
			expect(game.state.players[PLAYER_2.id].position).toBe(6);
		});

		it("should skip slipstream when not available", () => {
			const game = new Game(
				{
					players: [PLAYER_1, PLAYER_2],
					map: "USA",
				},
				{ shuffle: noShuffle },
			);

			// P1: upgrade 5 = 5 movement → position 5
			// P2: upgrade 0 = 0 movement → position 0
			game.dispatch(PLAYER_1.id, { type: "plan", gear: 1, cardIndices: [4] });
			game.dispatch(PLAYER_2.id, { type: "plan", gear: 1, cardIndices: [5] });

			// P1 resolves first - acknowledge move
			expect(game.state.currentState).toBe("move");
			game.dispatch(PLAYER_1.id, { type: "move" });
			// P1 is leader, no adrenaline, goes to react
			expect(game.state.currentState).toBe("react");
			game.dispatch(PLAYER_1.id, { type: "react", action: "skip" });
			// P1 is alone at position 5, slipstream skipped
			expect(game.state.currentState).toBe("discard");
			game.dispatch(PLAYER_1.id, { type: "discard", cardIndices: [] });

			// P2 resolves - acknowledge move
			expect(game.state.currentState).toBe("move");
			game.dispatch(PLAYER_2.id, { type: "move" });
			// P2 at position 0, P1 at position 5 - too far to slipstream
			// P2 has adrenaline (trailing player at game start)
			expect(game.state.currentState).toBe("adrenaline");
			game.dispatch(PLAYER_2.id, {
				type: "adrenaline",
				acceptMove: false,
			});
			game.dispatch(PLAYER_2.id, { type: "react", action: "skip" });

			// Slipstream should be skipped, going directly to discard
			expect(game.state.currentState).toBe("discard");
		});
	});

	describe("corner penalty acknowledgment", () => {
		it("should skip cornerPenalty state when crossing corner under speed limit", () => {
			// Test map: corner at position 6 with speed limit 4
			const game = new Game(
				{ players: [PLAYER_1], map: "Test" },
				{ shuffle: noShuffle },
			);

			// Player starts at 0, plays speed 4 -> ends at 4, doesn't cross corner
			game.dispatch(PLAYER_1.id, { type: "plan", gear: 1, cardIndices: [6] });

			game.dispatch(PLAYER_1.id, { type: "move" });
			game.dispatch(PLAYER_1.id, { type: "adrenaline", acceptMove: false });
			game.dispatch(PLAYER_1.id, { type: "react", action: "skip" });

			// Should skip cornerPenalty and go directly to discard
			expect(game.state.currentState).toBe("discard");
			expect(
				game.state.players[PLAYER_1.id].turnActions.cornerPenalty,
			).toBeUndefined();
		});

		it("should enter cornerPenalty state when exceeding corner speed limit", () => {
			// Test map: corner at position 6 with speed limit 4
			const game = new Game(
				{ players: [PLAYER_1], map: "Test" },
				{ shuffle: noShuffle },
			);

			// Player starts at 0, plays upgrade 5 -> speed 5, ends at 5, crosses corner at 6
			// Wait, player ends at 5, corner is at 6, so won't cross it yet
			// Let's play two cards: upgrade 5 + speed 4 = 9 movement -> position 9, crosses corner at 6
			game.dispatch(PLAYER_1.id, {
				type: "plan",
				gear: 2,
				cardIndices: [6, 4],
			});

			game.dispatch(PLAYER_1.id, { type: "move" });
			game.dispatch(PLAYER_1.id, { type: "adrenaline", acceptMove: false });
			game.dispatch(PLAYER_1.id, { type: "react", action: "skip" });

			// Speed is 9, corner limit is 4, penalty is 5 heat
			// Should enter cornerPenalty state
			expect(game.state.currentState).toBe("cornerPenalty");

			// Verify penalty info is recorded
			const penalty = game.state.players[PLAYER_1.id].turnActions.cornerPenalty;
			expect(penalty).toBeDefined();
			expect(penalty!.corners).toHaveLength(1);
			expect(penalty!.corners[0].cornerPosition).toBe(6);
			expect(penalty!.corners[0].speedLimit).toBe(4);
			expect(penalty!.corners[0].playerSpeed).toBe(9);
			expect(penalty!.corners[0].penaltyAmount).toBe(5);
		});

		it("should transition to discard after acknowledging corner penalty", () => {
			const game = new Game(
				{ players: [PLAYER_1], map: "Test" },
				{ shuffle: noShuffle },
			);

			game.dispatch(PLAYER_1.id, {
				type: "plan",
				gear: 2,
				cardIndices: [6, 4],
			});
			game.dispatch(PLAYER_1.id, { type: "move" });
			game.dispatch(PLAYER_1.id, { type: "adrenaline", acceptMove: false });
			game.dispatch(PLAYER_1.id, { type: "react", action: "skip" });

			expect(game.state.currentState).toBe("cornerPenalty");

			game.dispatch(PLAYER_1.id, { type: "cornerPenalty" });

			expect(game.state.currentState).toBe("discard");
		});

		it("should record spinout when player cannot pay full heat penalty", () => {
			// Test map: corner at position 6 (limit 4), corner at position 15 (limit 3)
			const game = new Game(
				{ players: [PLAYER_1], map: "Test" },
				{ shuffle: noShuffle },
			);

			// Player starts with 6 heat in engine
			expect(game.state.players[PLAYER_1.id].engineSize).toBe(6);

			// Turn 1: Shift 1->3 (costs 1 heat = 5 remaining)
			// Play speed 4 + upgrade 5 + upgrade 0 = 9 speed
			// Crosses corner at 6 (limit 4), penalty = 5, pays all 5 heat, 0 remaining
			game.dispatch(PLAYER_1.id, {
				type: "plan",
				gear: 3,
				cardIndices: [6, 4, 5],
			});
			game.dispatch(PLAYER_1.id, { type: "move" });
			game.dispatch(PLAYER_1.id, { type: "adrenaline", acceptMove: false });
			game.dispatch(PLAYER_1.id, { type: "react", action: "skip" });

			expect(game.state.currentState).toBe("cornerPenalty");
			expect(game.state.players[PLAYER_1.id].engineSize).toBe(0);
			game.dispatch(PLAYER_1.id, { type: "cornerPenalty" });
			game.dispatch(PLAYER_1.id, { type: "discard", cardIndices: [] });

			// Player at position 9, has 0 heat
			expect(game.state.players[PLAYER_1.id].position).toBe(9);

			// Turn 2: Shift 3->2 (no heat cost), play speed4 + speed4 = 8 speed
			// With noShuffle, hand after draw has: [stress, stress, stress, heat, speed4, speed4, speed3]
			// Play indices 4 and 5 (speed4 + speed4) = 8 speed
			// Position 9 + 8 = 17, crosses corner at 15 (limit 3)
			// Penalty = 8 - 3 = 5, but 0 heat available = spinout!
			game.dispatch(PLAYER_1.id, {
				type: "plan",
				gear: 2,
				cardIndices: [4, 5],
			});
			game.dispatch(PLAYER_1.id, { type: "move" });
			game.dispatch(PLAYER_1.id, { type: "adrenaline", acceptMove: false });
			game.dispatch(PLAYER_1.id, { type: "react", action: "skip" });

			// Must enter cornerPenalty state with spinout
			expect(game.state.currentState).toBe("cornerPenalty");

			const penalty = game.state.players[PLAYER_1.id].turnActions.cornerPenalty;
			expect(penalty).toBeDefined();
			expect(penalty!.spinout).toBeDefined();
			expect(penalty!.spinout!.newGear).toBe(1);
			expect(penalty!.spinout!.cornerPosition).toBe(15);
			expect(penalty!.spinout!.newPosition).toBe(14);
			// In gear 2, spinout gives 1 stress card
			expect(penalty!.spinout!.stressCardsReceived).toBe(1);

			// Verify player state reflects spinout
			expect(game.state.players[PLAYER_1.id].position).toBe(14);
			expect(game.state.players[PLAYER_1.id].gear).toBe(1);
		});

		it("should record heat paid in corner penalty result", () => {
			const game = new Game(
				{ players: [PLAYER_1], map: "Test" },
				{ shuffle: noShuffle },
			);

			// Player starts with 6 heat in engine
			expect(game.state.players[PLAYER_1.id].engineSize).toBe(6);

			// Play speed 4 + upgrade 5 = 9 speed, crosses corner at 6 (limit 4)
			// Penalty = 5 heat to pay
			game.dispatch(PLAYER_1.id, {
				type: "plan",
				gear: 2,
				cardIndices: [6, 4],
			});
			game.dispatch(PLAYER_1.id, { type: "move" });
			game.dispatch(PLAYER_1.id, { type: "adrenaline", acceptMove: false });
			game.dispatch(PLAYER_1.id, { type: "react", action: "skip" });

			expect(game.state.currentState).toBe("cornerPenalty");

			const penalty = game.state.players[PLAYER_1.id].turnActions.cornerPenalty;
			expect(penalty).toBeDefined();
			expect(penalty!.corners[0].heatPaid).toBe(5);
			// Engine should now have 1 heat remaining (6 - 5)
			expect(game.state.players[PLAYER_1.id].engineSize).toBe(1);
		});

		it("should skip cornerPenalty when corner is crossed at or below speed limit", () => {
			const game = new Game(
				{ players: [PLAYER_1], map: "Test" },
				{ shuffle: noShuffle },
			);

			// Move to position 2 first turn, then position 6+ at speed 4 (corner limit is 4)
			game.dispatch(PLAYER_1.id, { type: "plan", gear: 1, cardIndices: [5] }); // upgrade 0
			game.dispatch(PLAYER_1.id, { type: "move" });
			game.dispatch(PLAYER_1.id, { type: "adrenaline", acceptMove: false });
			game.dispatch(PLAYER_1.id, { type: "react", action: "skip" });
			game.dispatch(PLAYER_1.id, { type: "discard", cardIndices: [] });

			// Player at position 0, turn 2
			game.dispatch(PLAYER_1.id, {
				type: "plan",
				gear: 2,
				cardIndices: [4, 5],
			}); // upgrade 5 + upgrade 0 = 5 + 0 = 5

			// Actually need more movement. Let's check player's position
			// Player is at position 0 after turn 1 (moved 0)
			// Turn 2: play upgrade 5 = 5 movement, end at position 5
			// Still doesn't cross corner at 6

			// Let's try a different approach - start fresh and cross corner at exactly speed limit
			const game2 = new Game(
				{ players: [PLAYER_1], map: "Test" },
				{ shuffle: noShuffle },
			);

			// Position 0, play speed 4 + upgrade 0 + upgrade 0 + upgrade 0 = 4 speed in gear 4
			// Actually simpler: play speed 4 three turns to cross corner at speed 4
			// Turn 1: speed 4 -> position 4
			game2.dispatch(PLAYER_1.id, { type: "plan", gear: 1, cardIndices: [6] });
			game2.dispatch(PLAYER_1.id, { type: "move" });
			game2.dispatch(PLAYER_1.id, { type: "adrenaline", acceptMove: false });
			game2.dispatch(PLAYER_1.id, { type: "react", action: "skip" });
			game2.dispatch(PLAYER_1.id, { type: "discard", cardIndices: [] });

			// Turn 2: position 4, play speed card = 4, end at 8, crosses corner at 6 at speed 4
			// Speed 4 = corner limit 4, no penalty
			game2.dispatch(PLAYER_1.id, { type: "plan", gear: 1, cardIndices: [6] });
			game2.dispatch(PLAYER_1.id, { type: "move" });
			game2.dispatch(PLAYER_1.id, { type: "adrenaline", acceptMove: false });
			game2.dispatch(PLAYER_1.id, { type: "react", action: "skip" });

			// Should skip cornerPenalty state since speed <= limit
			expect(game2.state.currentState).toBe("discard");
			expect(
				game2.state.players[PLAYER_1.id].turnActions.cornerPenalty,
			).toBeUndefined();
		});
	});

	describe("race completion", () => {
		it("should initialize with configurable laps and empty finish state", () => {
			const defaultGame = new Game(
				{ players: [PLAYER_1], map: "USA" },
				{ shuffle: noShuffle },
			);
			expect(defaultGame.state.laps).toBe(1);
			expect(defaultGame.state.finishOrder).toEqual([]);
			expect(defaultGame.state.players[PLAYER_1.id].lap).toBe(1);
			expect(defaultGame.state.players[PLAYER_1.id].finished).toBe(false);

			const customGame = new Game(
				{ players: [PLAYER_1], map: "USA", laps: 3 },
				{ shuffle: noShuffle },
			);
			expect(customGame.state.laps).toBe(3);
		});

		it("should update laps, finish race, and sort finishOrder by position", () => {
			const game = new Game(
				{ players: [PLAYER_1, PLAYER_2], map: "Test", laps: 2 },
				{ shuffle: noShuffle },
			);

			// Play until race finishes (track length 24, 2 laps = finish at 48)
			let turns = 0;
			let sawLap2 = false;
			while (game.state.phase !== "finished" && turns < 30) {
				turns++;
				for (const playerId of [PLAYER_1.id, PLAYER_2.id]) {
					const hand = game.state.players[playerId].hand;
					const playableIndex = hand.findIndex(
						(c) => c.type !== "heat" && c.type !== "stress",
					);
					game.dispatch(playerId, {
						type: "plan",
						gear: 1,
						cardIndices: [playableIndex >= 0 ? playableIndex : 0],
					});
				}
				completeResolutionPhase(game);

				if (game.state.players[PLAYER_1.id].lap >= 2) {
					sawLap2 = true;
				}
			}

			expect(sawLap2).toBe(true);
			expect(game.state.phase).toBe("finished");
			expect(game.state.players[PLAYER_1.id].finished).toBe(true);
			expect(game.state.players[PLAYER_1.id].position).toBeGreaterThanOrEqual(
				48,
			);

			// finishOrder sorted by position (highest first)
			const p1Pos = game.state.players[PLAYER_1.id].position;
			const p2Pos = game.state.players[PLAYER_2.id].position;
			if (p1Pos !== p2Pos) {
				const expectedFirst = p1Pos > p2Pos ? PLAYER_1.id : PLAYER_2.id;
				expect(game.state.finishOrder[0]).toBe(expectedFirst);
			}
		});
	});
});
