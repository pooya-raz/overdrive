import { describe, expect, it } from "vitest";
import {
	type Card,
	type CreateGameRequest,
	Game,
	type ShuffleFn,
} from "./game-engine";

const PLAYER_1_ID = "550e8400-e29b-41d4-a716-446655440001";
const PLAYER_2_ID = "550e8400-e29b-41d4-a716-446655440002";
const PLAYER_3_ID = "550e8400-e29b-41d4-a716-446655440003";
const PLAYER_4_ID = "550e8400-e29b-41d4-a716-446655440004";
const PLAYER_5_ID = "550e8400-e29b-41d4-a716-446655440005";

const noShuffle: ShuffleFn = <T>(items: T[]) => items;

/** Helper to complete resolution phase for all players in turn order */
function completeResolutionPhase(game: Game): void {
	// Players resolve in turn order (leader first), one at a time
	for (const playerId of game.state.turnOrder) {
		game.dispatch(playerId, {
			type: "adrenaline",
			acceptMove: false,
			acceptCooldown: false,
		});
		game.dispatch(playerId, { type: "react", action: "skip" });
		game.dispatch(playerId, { type: "slipstream", distance: 0 });
		game.dispatch(playerId, { type: "discard", cardIndices: [] });
	}
}

const USA_STARTING_ENGINE: Card[] = [
	{ type: "heat" },
	{ type: "heat" },
	{ type: "heat" },
	{ type: "heat" },
	{ type: "heat" },
	{ type: "heat" },
];

describe("Game", () => {
	describe("initialization", () => {
		it("should create a game with players on turn 1", () => {
			const request: CreateGameRequest = {
				playerIds: [PLAYER_1_ID, PLAYER_2_ID],
				map: "USA",
			};

			const game = new Game(request, { shuffle: noShuffle });

			expect(game.state.turn).toBe(1);
			expect(game.state.phase).toBe("planning");
			expect(game.state.currentState).toBe("plan");
			expect(game.state.pendingPlayers).toEqual({
				[PLAYER_1_ID]: true,
				[PLAYER_2_ID]: true,
			});

			for (const id of request.playerIds) {
				const player = game.state.players[id];
				expect(player.gear).toBe(1);
				expect(player.engine).toEqual(USA_STARTING_ENGINE);
				expect(player.discard).toEqual([]);
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
				expect(player.deck).toEqual([
					{ type: "speed", value: 1 },
					{ type: "speed", value: 1 },
					{ type: "speed", value: 1 },
					{ type: "speed", value: 2 },
					{ type: "speed", value: 2 },
					{ type: "speed", value: 2 },
					{ type: "speed", value: 3 },
					{ type: "speed", value: 3 },
					{ type: "speed", value: 3 },
					{ type: "speed", value: 4 },
					{ type: "speed", value: 4 },
				]);
			}
			expect(game.state.map).toBe("USA");
		});

		it("should reject duplicate player UUIDs", () => {
			const request: CreateGameRequest = {
				playerIds: [PLAYER_1_ID, PLAYER_1_ID],
				map: "USA",
			};

			expect(() => new Game(request)).toThrow("Player IDs must be unique");
		});

		it("should shuffle deck at game start", () => {
			const hands: string[] = [];

			for (let i = 0; i < 10; i++) {
				const game = new Game({
					playerIds: [PLAYER_1_ID],
					map: "USA",
				});
				hands.push(JSON.stringify(game.state.players[PLAYER_1_ID].hand));
			}

			const uniqueHands = new Set(hands);
			expect(uniqueHands.size).toBeGreaterThan(1);
		});
	});

	describe("dispatch", () => {
		describe("validation", () => {
			it("should reject action for wrong state", () => {
				const game = new Game(
					{
						playerIds: [PLAYER_1_ID],
						map: "USA",
					},
					{ shuffle: noShuffle },
				);

				// Submit plan to enter resolution phase
				game.dispatch(PLAYER_1_ID, { type: "plan", gear: 1, cardIndices: [6] });

				// Now in resolution phase, plan action should be rejected
				expect(() =>
					game.dispatch(PLAYER_1_ID, {
						type: "plan",
						gear: 2,
						cardIndices: [5],
					}),
				).toThrow("Invalid action for state adrenaline");
			});

			it("should reject action for unknown player", () => {
				const game = new Game(
					{
						playerIds: [PLAYER_1_ID],
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
						playerIds: [PLAYER_1_ID, PLAYER_2_ID],
						map: "USA",
					},
					{ shuffle: noShuffle },
				);

				game.dispatch(PLAYER_1_ID, {
					type: "plan",
					gear: 2,
					cardIndices: [6, 5],
				});

				expect(() =>
					game.dispatch(PLAYER_1_ID, {
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
						playerIds: [PLAYER_1_ID, PLAYER_2_ID],
						map: "USA",
					},
					{ shuffle: noShuffle },
				);

				game.dispatch(PLAYER_1_ID, {
					type: "plan",
					gear: 2,
					cardIndices: [6, 5],
				});

				expect(game.state.pendingPlayers).toEqual({
					[PLAYER_1_ID]: false,
					[PLAYER_2_ID]: true,
				});
			});

			it("should enter resolution phase when all players submit plan", () => {
				const game = new Game(
					{
						playerIds: [PLAYER_1_ID, PLAYER_2_ID],
						map: "USA",
					},
					{ shuffle: noShuffle },
				);

				game.dispatch(PLAYER_1_ID, {
					type: "plan",
					gear: 2,
					cardIndices: [6, 5],
				});
				game.dispatch(PLAYER_2_ID, {
					type: "plan",
					gear: 2,
					cardIndices: [6, 5],
				});

				expect(game.state.turn).toBe(1);
				expect(game.state.phase).toBe("resolution");
				expect(game.state.currentState).toBe("adrenaline");

				for (const id of [PLAYER_1_ID, PLAYER_2_ID]) {
					const player = game.state.players[id];
					expect(player.gear).toBe(2);
					expect(player.engine).toEqual(USA_STARTING_ENGINE);
					expect(player.discard).toEqual([]);
					expect(player.hand).toHaveLength(5); // 7 - 2 played
					expect(player.deck).toHaveLength(11);
				}
			});

			it("should advance to next turn after resolution phase completes", () => {
				const game = new Game(
					{
						playerIds: [PLAYER_1_ID],
						map: "USA",
					},
					{ shuffle: noShuffle },
				);

				// Planning phase - gear 1 means play 1 card
				game.dispatch(PLAYER_1_ID, { type: "plan", gear: 1, cardIndices: [6] });

				// Resolution phase - dispatch required input actions
				game.dispatch(PLAYER_1_ID, {
					type: "adrenaline",
					acceptMove: false,
					acceptCooldown: false,
				});
				game.dispatch(PLAYER_1_ID, { type: "react", action: "skip" });
				game.dispatch(PLAYER_1_ID, { type: "slipstream", distance: 0 });
				game.dispatch(PLAYER_1_ID, { type: "discard", cardIndices: [] });

				// After all resolution states, should be back to planning phase turn 2
				expect(game.state.turn).toBe(2);
				expect(game.state.phase).toBe("planning");
				expect(game.state.currentState).toBe("plan");
			});
		});
	});

	describe("adrenaline", () => {
		it("should initialize players without adrenaline", () => {
			const game = new Game(
				{
					playerIds: [PLAYER_1_ID, PLAYER_2_ID],
					map: "USA",
				},
				{ shuffle: noShuffle },
			);

			expect(game.state.players[PLAYER_1_ID].hasAdrenaline).toBe(false);
			expect(game.state.players[PLAYER_2_ID].hasAdrenaline).toBe(false);
		});

		it("should give adrenaline to last position player after resolution", () => {
			const game = new Game(
				{
					playerIds: [PLAYER_1_ID, PLAYER_2_ID],
					map: "USA",
				},
				{ shuffle: noShuffle },
			);

			// Player 1: gear 2, speed 4 + upgrade 0 = 4 movement
			// Player 2: gear 1, speed 4 = 4 movement
			// With noShuffle, hand[6] = speed 4, hand[5] = upgrade 0
			game.dispatch(PLAYER_1_ID, {
				type: "plan",
				gear: 2,
				cardIndices: [6, 5],
			});
			game.dispatch(PLAYER_2_ID, { type: "plan", gear: 1, cardIndices: [6] });

			// Complete resolution phase
			completeResolutionPhase(game);

			// After resolution: adrenaline assigned to trailing player
			expect(game.state.phase).toBe("planning");

			const p1Adrenaline = game.state.players[PLAYER_1_ID].hasAdrenaline;
			const p2Adrenaline = game.state.players[PLAYER_2_ID].hasAdrenaline;
			// At least one should have it (the one in last or tied for last)
			expect(p1Adrenaline || p2Adrenaline).toBe(true);
		});

		it("should give adrenaline to player with lower position", () => {
			const game = new Game(
				{
					playerIds: [PLAYER_1_ID, PLAYER_2_ID],
					map: "USA",
				},
				{ shuffle: noShuffle },
			);

			// Player 1: gear 1, upgrade 0 (0 movement) - index 5
			// Player 2: gear 2, speed 4 + upgrade 5 = 9 movement - indices 6, 4
			game.dispatch(PLAYER_1_ID, { type: "plan", gear: 1, cardIndices: [5] });
			game.dispatch(PLAYER_2_ID, {
				type: "plan",
				gear: 2,
				cardIndices: [6, 4],
			});

			// Complete resolution phase
			completeResolutionPhase(game);

			// Player 1 at position 0, Player 2 at position 9
			// Player 1 (lower position) should have adrenaline
			expect(game.state.players[PLAYER_1_ID].hasAdrenaline).toBe(true);
			expect(game.state.players[PLAYER_2_ID].hasAdrenaline).toBe(false);
		});

		it("should give adrenaline to last 2 players in 5+ player game", () => {
			const game = new Game(
				{
					playerIds: [
						PLAYER_1_ID,
						PLAYER_2_ID,
						PLAYER_3_ID,
						PLAYER_4_ID,
						PLAYER_5_ID,
					],
					map: "USA",
				},
				{ shuffle: noShuffle },
			);

			// Player 1: upgrade 0 = 0 movement
			// Player 2: upgrade 0 = 0 movement
			// Player 3: speed 4 = 4 movement
			// Player 4: speed 4 = 4 movement
			// Player 5: speed 4 = 4 movement
			game.dispatch(PLAYER_1_ID, { type: "plan", gear: 1, cardIndices: [5] });
			game.dispatch(PLAYER_2_ID, { type: "plan", gear: 1, cardIndices: [5] });
			game.dispatch(PLAYER_3_ID, { type: "plan", gear: 1, cardIndices: [6] });
			game.dispatch(PLAYER_4_ID, { type: "plan", gear: 1, cardIndices: [6] });
			game.dispatch(PLAYER_5_ID, { type: "plan", gear: 1, cardIndices: [6] });

			// Complete resolution phase
			completeResolutionPhase(game);

			// Players 1 and 2 at position 0 (tied for last)
			// They should both have adrenaline
			expect(game.state.players[PLAYER_1_ID].hasAdrenaline).toBe(true);
			expect(game.state.players[PLAYER_2_ID].hasAdrenaline).toBe(true);
			expect(game.state.players[PLAYER_3_ID].hasAdrenaline).toBe(false);
			expect(game.state.players[PLAYER_4_ID].hasAdrenaline).toBe(false);
			expect(game.state.players[PLAYER_5_ID].hasAdrenaline).toBe(false);
		});

		it("should reset adrenaline when entering resolution phase", () => {
			const game = new Game(
				{
					playerIds: [PLAYER_1_ID, PLAYER_2_ID],
					map: "USA",
				},
				{ shuffle: noShuffle },
			);

			// Complete turn 1
			game.dispatch(PLAYER_1_ID, { type: "plan", gear: 1, cardIndices: [5] });
			game.dispatch(PLAYER_2_ID, {
				type: "plan",
				gear: 2,
				cardIndices: [6, 4],
			});
			completeResolutionPhase(game);

			// Verify adrenaline was assigned after turn 1
			expect(game.state.turn).toBe(2);
			expect(game.state.players[PLAYER_1_ID].hasAdrenaline).toBe(true);

			// After entering resolution (both players submit plan), adrenaline resets
			game.dispatch(PLAYER_1_ID, { type: "plan", gear: 1, cardIndices: [4] });
			game.dispatch(PLAYER_2_ID, { type: "plan", gear: 1, cardIndices: [3] });

			// Now in resolution phase, adrenaline should be reset
			expect(game.state.phase).toBe("resolution");
			expect(game.state.players[PLAYER_1_ID].hasAdrenaline).toBe(false);
			expect(game.state.players[PLAYER_2_ID].hasAdrenaline).toBe(false);
		});
	});

	describe("position collision", () => {
		it("should assign raceline to first player arriving at position", () => {
			const game = new Game(
				{
					playerIds: [PLAYER_1_ID, PLAYER_2_ID],
					map: "USA",
				},
				{ shuffle: noShuffle },
			);

			// Both players: gear 1, speed 4 = 4 movement
			game.dispatch(PLAYER_1_ID, { type: "plan", gear: 1, cardIndices: [6] });
			game.dispatch(PLAYER_2_ID, { type: "plan", gear: 1, cardIndices: [6] });

			// Complete resolution phase
			completeResolutionPhase(game);

			// Both end at position 4, first in turn order (PLAYER_1) gets raceline
			expect(game.state.players[PLAYER_1_ID].position).toBe(4);
			expect(game.state.players[PLAYER_1_ID].onRaceline).toBe(true);
			expect(game.state.players[PLAYER_2_ID].position).toBe(4);
			expect(game.state.players[PLAYER_2_ID].onRaceline).toBe(false);

			//Player 2 should get adrenaline
			expect(game.state.players[PLAYER_2_ID].hasAdrenaline).toBe(true);
			expect(game.state.players[PLAYER_1_ID].hasAdrenaline).toBe(false);
		});

		it("should cascade third player back when position is full", () => {
			const game = new Game(
				{
					playerIds: [PLAYER_1_ID, PLAYER_2_ID, PLAYER_3_ID],
					map: "USA",
				},
				{ shuffle: noShuffle },
			);

			// All three players: gear 1, speed 4 = 4 movement
			game.dispatch(PLAYER_1_ID, { type: "plan", gear: 1, cardIndices: [6] });
			game.dispatch(PLAYER_2_ID, { type: "plan", gear: 1, cardIndices: [6] });
			game.dispatch(PLAYER_3_ID, { type: "plan", gear: 1, cardIndices: [6] });

			// Complete resolution phase
			completeResolutionPhase(game);

			// Position 4 is full (P1 on raceline, P2 off), P3 cascades to position 3
			expect(game.state.players[PLAYER_1_ID].position).toBe(4);
			expect(game.state.players[PLAYER_1_ID].onRaceline).toBe(true);
			expect(game.state.players[PLAYER_2_ID].position).toBe(4);
			expect(game.state.players[PLAYER_2_ID].onRaceline).toBe(false);
			expect(game.state.players[PLAYER_3_ID].position).toBe(3);
			expect(game.state.players[PLAYER_3_ID].onRaceline).toBe(true);
		});

		it("should cascade multiple positions when all are full", () => {
			const game = new Game(
				{
					playerIds: [
						PLAYER_1_ID,
						PLAYER_2_ID,
						PLAYER_3_ID,
						PLAYER_4_ID,
						PLAYER_5_ID,
					],
					map: "USA",
				},
				{ shuffle: noShuffle },
			);

			// All five players: gear 1, speed 4 = 4 movement
			for (const id of [
				PLAYER_1_ID,
				PLAYER_2_ID,
				PLAYER_3_ID,
				PLAYER_4_ID,
				PLAYER_5_ID,
			]) {
				game.dispatch(id, { type: "plan", gear: 1, cardIndices: [6] });
			}

			// Complete resolution phase
			completeResolutionPhase(game);

			// P1, P2 at position 4; P3, P4 at position 3; P5 at position 2
			expect(game.state.players[PLAYER_1_ID].position).toBe(4);
			expect(game.state.players[PLAYER_2_ID].position).toBe(4);
			expect(game.state.players[PLAYER_3_ID].position).toBe(3);
			expect(game.state.players[PLAYER_4_ID].position).toBe(3);
			expect(game.state.players[PLAYER_5_ID].position).toBe(2);
		});
	});
});
