import { describe, expect, it } from "vitest";
import {
	type Card,
	type CreateGameRequest,
	Game,
	type ShuffleFn,
} from "./game-engine";

const PLAYER_1_ID = "550e8400-e29b-41d4-a716-446655440001";
const PLAYER_2_ID = "550e8400-e29b-41d4-a716-446655440002";

const noShuffle: ShuffleFn = <T>(items: T[]) => items;

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
			expect(game.state.phase).toBe("shift");
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

		it("should store map in game state", () => {
			const game = new Game(
				{
					playerIds: [PLAYER_1_ID],
					map: "USA",
				},
				{ shuffle: noShuffle },
			);

			expect(game.state.map).toBe("USA");
		});
	});

	describe("dispatch", () => {
		it("should mark player as acted after action", () => {
			const game = new Game(
				{
					playerIds: [PLAYER_1_ID, PLAYER_2_ID],
					map: "USA",
				},
				{ shuffle: noShuffle },
			);

			game.dispatch(PLAYER_1_ID, { type: "shift", gear: 2 });

			expect(game.state.pendingPlayers).toEqual({
				[PLAYER_1_ID]: false,
				[PLAYER_2_ID]: true,
			});
		});

		it("should advance turn after all phases complete", () => {
			const game = new Game(
				{
					playerIds: [PLAYER_1_ID],
					map: "USA",
				},
				{ shuffle: noShuffle },
			);

			game.dispatch(PLAYER_1_ID, { type: "shift", gear: 2 });
			game._state.phase = "discardAndReplenish";
			game._state.pendingPlayers = { [PLAYER_1_ID]: true };
			game.dispatch(PLAYER_1_ID, {
				type: "discardAndReplenish",
				discardIndices: [],
			});

			expect(game.state.turn).toBe(2);
			expect(game.state.phase).toBe("shift");
		});

		it("should reject action for wrong phase", () => {
			const game = new Game(
				{
					playerIds: [PLAYER_1_ID],
					map: "USA",
				},
				{ shuffle: noShuffle },
			);
			game._state.phase = "playCards";

			expect(() =>
				game.dispatch(PLAYER_1_ID, { type: "shift", gear: 2 }),
			).toThrow("Invalid action for phase playCards");
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
				game.dispatch("unknown-player-id", { type: "shift", gear: 2 }),
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

			game.dispatch(PLAYER_1_ID, { type: "shift", gear: 2 });

			expect(() =>
				game.dispatch(PLAYER_1_ID, { type: "shift", gear: 3 }),
			).toThrow("Player has already acted this phase");
		});

		describe("shift", () => {
			it("should shift player gear and move to new phase", () => {
				const game = new Game(
					{
						playerIds: [PLAYER_1_ID, PLAYER_2_ID],
						map: "USA",
					},
					{ shuffle: noShuffle },
				);

				game.dispatch(PLAYER_1_ID, { type: "shift", gear: 2 });
				game.dispatch(PLAYER_2_ID, { type: "shift", gear: 2 });

				expect(game.state.turn).toBe(1);
				expect(game.state.phase).toBe("playCards");
				expect(game.state.pendingPlayers).toEqual({
					[PLAYER_1_ID]: true,
					[PLAYER_2_ID]: true,
				});

				for (const id of [PLAYER_1_ID, PLAYER_2_ID]) {
					const player = game.state.players[id];
					expect(player.gear).toBe(2);
					expect(player.engine).toEqual(USA_STARTING_ENGINE);
					expect(player.discard).toEqual([]);
					expect(player.hand).toHaveLength(7);
					expect(player.deck).toHaveLength(11);
				}
			});

			it("should reject shift of more than 1 gear", () => {
				const game = new Game(
					{
						playerIds: [PLAYER_1_ID],
						map: "USA",
					},
					{ shuffle: noShuffle },
				);

				game._state.players[PLAYER_1_ID].engine = [];

				expect(() =>
					game.dispatch(PLAYER_1_ID, { type: "shift", gear: 3 }),
				).toThrow("Heat card required to shift by 2 gears");
			});
		});

		describe("playCards", () => {
			it("should move cards from hand to played", () => {
				const game = new Game(
					{
						playerIds: [PLAYER_1_ID],
						map: "USA",
					},
					{ shuffle: noShuffle },
				);

				game.dispatch(PLAYER_1_ID, { type: "shift", gear: 2 });

				// With noShuffle, hand is: stress, stress, stress, heat, upgrade(5), upgrade(0), speed(4)
				// Playing indices [5, 6] plays upgrade(0) and speed(4)
				game.dispatch(PLAYER_1_ID, { type: "playCards", cardIndices: [5, 6] });

				const player = game.state.players[PLAYER_1_ID];
				expect(player.played).toEqual([
					{ type: "speed", value: 4 },
					{ type: "upgrade", value: 0 },
				]);
				expect(player.hand).toHaveLength(5);
				expect(game.state.phase).toBe("discardAndReplenish");
			});

			it("should reject wrong number of cards", () => {
				const game = new Game(
					{
						playerIds: [PLAYER_1_ID],
						map: "USA",
					},
					{ shuffle: noShuffle },
				);

				game.dispatch(PLAYER_1_ID, { type: "shift", gear: 2 });

				expect(() =>
					game.dispatch(PLAYER_1_ID, { type: "playCards", cardIndices: [0] }),
				).toThrow("Must play exactly 2 cards");
			});

			it("should reject invalid card index", () => {
				const game = new Game(
					{
						playerIds: [PLAYER_1_ID],
						map: "USA",
					},
					{ shuffle: noShuffle },
				);

				game.dispatch(PLAYER_1_ID, { type: "shift", gear: 2 });

				expect(() =>
					game.dispatch(PLAYER_1_ID, {
						type: "playCards",
						cardIndices: [0, 99],
					}),
				).toThrow("Invalid card index: 99");
			});
		});

		describe("move", () => {
			it("should initialize players at position 0", () => {
				const game = new Game(
					{
						playerIds: [PLAYER_1_ID, PLAYER_2_ID],
						map: "USA",
					},
					{ shuffle: noShuffle },
				);

				expect(game.state.players[PLAYER_1_ID].position).toBe(0);
				expect(game.state.players[PLAYER_2_ID].position).toBe(0);
			});

			it("should move players based on played card values", () => {
				const game = new Game(
					{
						playerIds: [PLAYER_1_ID],
						map: "USA",
					},
					{ shuffle: noShuffle },
				);

				game.dispatch(PLAYER_1_ID, { type: "shift", gear: 2 });
				// With noShuffle, hand is: stress, stress, stress, heat, upgrade(5), upgrade(0), speed(4)
				// Playing indices [4, 6] plays upgrade(5) and speed(4) = 9 movement
				game.dispatch(PLAYER_1_ID, {
					type: "playCards",
					cardIndices: [4, 6],
				});

				expect(game.state.players[PLAYER_1_ID].position).toBe(9);
			});

			it("should auto-advance from move to discardAndReplenish", () => {
				const game = new Game(
					{
						playerIds: [PLAYER_1_ID],
						map: "USA",
					},
					{ shuffle: noShuffle },
				);

				game.dispatch(PLAYER_1_ID, { type: "shift", gear: 1 });
				// Playing index 6 plays speed(4)
				game.dispatch(PLAYER_1_ID, { type: "playCards", cardIndices: [6] });

				expect(game.state.phase).toBe("discardAndReplenish");
			});

			it("should accumulate position across turns", () => {
				const game = new Game(
					{
						playerIds: [PLAYER_1_ID],
						map: "USA",
					},
					{ shuffle: noShuffle },
				);

				// Turn 1: play speed(4) at index 6
				game.dispatch(PLAYER_1_ID, { type: "shift", gear: 1 });
				game.dispatch(PLAYER_1_ID, {
					type: "playCards",
					cardIndices: [6],
				});

				expect(game.state.players[PLAYER_1_ID].position).toBe(4);

				game.dispatch(PLAYER_1_ID, {
					type: "discardAndReplenish",
					discardIndices: [],
				});

				// Turn 2: hand now has speed(4) at index 6 (drawn from deck)
				game.dispatch(PLAYER_1_ID, { type: "shift", gear: 1 });
				game.dispatch(PLAYER_1_ID, {
					type: "playCards",
					cardIndices: [6],
				});

				expect(game.state.players[PLAYER_1_ID].position).toBe(8);
			});

			it("should resolve stress cards by drawing from deck", () => {
				const game = new Game(
					{
						playerIds: [PLAYER_1_ID],
						map: "USA",
					},
					{ shuffle: noShuffle },
				);

				// With noShuffle:
				// Hand: stress, stress, stress, heat, upgrade(5), upgrade(0), speed(4)
				// Deck: speed(1), speed(1), speed(1), speed(2), speed(2), speed(2),
				//       speed(3), speed(3), speed(3), speed(4), speed(4)
				// Playing stress card at index 0 should draw speed(4) from deck end
				game.dispatch(PLAYER_1_ID, { type: "shift", gear: 1 });
				game.dispatch(PLAYER_1_ID, { type: "playCards", cardIndices: [0] });

				// Stress resolves to speed(4) from deck
				expect(game.state.players[PLAYER_1_ID].position).toBe(4);
			});
		});
	});
});
