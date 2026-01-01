import { describe, expect, it } from "vitest";
import { type Card, type CreateGameRequest, Game } from "./game-engine";

const PLAYER_1_ID = "550e8400-e29b-41d4-a716-446655440001";
const PLAYER_2_ID = "550e8400-e29b-41d4-a716-446655440002";

const USA_STARTING_DECK: Card[] = [
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
	{ type: "speed", value: 4 },
	{ type: "upgrade", value: 0 },
	{ type: "upgrade", value: 5 },
	{ type: "heat" },
	{ type: "stress" },
	{ type: "stress" },
	{ type: "stress" },
];

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

			const game = new Game(request);

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
				expect(player.hand).toHaveLength(7);
				expect(player.deck).toHaveLength(USA_STARTING_DECK.length - 7);
				expect([...player.deck, ...player.hand]).toEqual(
					expect.arrayContaining(USA_STARTING_DECK),
				);
				expect(USA_STARTING_DECK).toEqual(
					expect.arrayContaining([...player.deck, ...player.hand]),
				);
			}
		});

		it("should reject duplicate player UUIDs", () => {
			const request: CreateGameRequest = {
				playerIds: [PLAYER_1_ID, PLAYER_1_ID],
				map: "USA",
			};

			expect(() => new Game(request)).toThrow("Player IDs must be unique");
		});
	});

	describe("dispatch", () => {
		it("should mark player as acted after action", () => {
			const game = new Game({
				playerIds: [PLAYER_1_ID, PLAYER_2_ID],
				map: "USA",
			});

			game.dispatch(PLAYER_1_ID, { type: "shift", gear: 2 });

			expect(game.state.pendingPlayers).toEqual({
				[PLAYER_1_ID]: false,
				[PLAYER_2_ID]: true,
			});
		});

		it("should advance turn after all phases complete", () => {
			const game = new Game({
				playerIds: [PLAYER_1_ID],
				map: "USA",
			});

			game.dispatch(PLAYER_1_ID, { type: "shift", gear: 2 });
			game._state.phase = "resolve";
			game._state.pendingPlayers = { [PLAYER_1_ID]: true };
			game.dispatch(PLAYER_1_ID, {
				type: "resolve" as never,
				gear: 2 as never,
			});

			expect(game.state.turn).toBe(2);
			expect(game.state.phase).toBe("shift");
		});

		it("should reject action for wrong phase", () => {
			const game = new Game({
				playerIds: [PLAYER_1_ID],
				map: "USA",
			});
			game._state.phase = "playCards";

			expect(() =>
				game.dispatch(PLAYER_1_ID, { type: "shift", gear: 2 }),
			).toThrow("Invalid action for phase playCards");
		});

		it("should reject action for unknown player", () => {
			const game = new Game({
				playerIds: [PLAYER_1_ID],
				map: "USA",
			});

			expect(() =>
				game.dispatch("unknown-player-id", { type: "shift", gear: 2 }),
			).toThrow("Player not found");
		});

		it("should reject action if player already acted", () => {
			const game = new Game({
				playerIds: [PLAYER_1_ID, PLAYER_2_ID],
				map: "USA",
			});

			game.dispatch(PLAYER_1_ID, { type: "shift", gear: 2 });

			expect(() =>
				game.dispatch(PLAYER_1_ID, { type: "shift", gear: 3 }),
			).toThrow("Player has already acted this phase");
		});

		describe("shift", () => {
			it("should shift player gear and move to new phase", () => {
				const game = new Game({
					playerIds: [PLAYER_1_ID, PLAYER_2_ID],
					map: "USA",
				});

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
					expect(player.deck).toHaveLength(USA_STARTING_DECK.length - 7);
					expect([...player.deck, ...player.hand]).toEqual(
						expect.arrayContaining(USA_STARTING_DECK),
					);
					expect(USA_STARTING_DECK).toEqual(
						expect.arrayContaining([...player.deck, ...player.hand]),
					);
				}
			});

			it("should reject shift of more than 1 gear", () => {
				const game = new Game({
					playerIds: [PLAYER_1_ID],
					map: "USA",
				});

				const player = game.state.players[PLAYER_1_ID];
				player.engine = [];

				expect(() =>
					game.dispatch(PLAYER_1_ID, { type: "shift", gear: 3 }),
				).toThrow("Heat card required to shift by 2 gears");
			});
		});
	});
});
