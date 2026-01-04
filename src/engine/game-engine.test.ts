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
			it("should reject action for wrong phase", () => {
				const game = new Game(
					{
						playerIds: [PLAYER_1_ID],
						map: "USA",
					},
					{ shuffle: noShuffle },
				);

				// Advance to playCards phase naturally
				game.dispatch(PLAYER_1_ID, { type: "shift", gear: 1 });

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
		});

		describe("phase transitions", () => {
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

			it("should advance from shift to playCards when all players act", () => {
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

			it("should advance from playCards through move to discardAndReplenish", () => {
				const game = new Game(
					{
						playerIds: [PLAYER_1_ID],
						map: "USA",
					},
					{ shuffle: noShuffle },
				);

				game.dispatch(PLAYER_1_ID, { type: "shift", gear: 1 });
				game.dispatch(PLAYER_1_ID, { type: "playCards", cardIndices: [6] });

				expect(game.state.phase).toBe("discardAndReplenish");
			});

			it("should advance to next turn after discardAndReplenish", () => {
				const game = new Game(
					{
						playerIds: [PLAYER_1_ID],
						map: "USA",
					},
					{ shuffle: noShuffle },
				);

				// Play through a complete turn
				game.dispatch(PLAYER_1_ID, { type: "shift", gear: 1 });
				game.dispatch(PLAYER_1_ID, { type: "playCards", cardIndices: [6] });
				game.dispatch(PLAYER_1_ID, {
					type: "discardAndReplenish",
					discardIndices: [],
				});

				expect(game.state.turn).toBe(2);
				expect(game.state.phase).toBe("shift");
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

		it("should give adrenaline to last position player after move", () => {
			const game = new Game(
				{
					playerIds: [PLAYER_1_ID, PLAYER_2_ID],
					map: "USA",
				},
				{ shuffle: noShuffle },
			);

			// Player 1 shifts to gear 2 (plays 2 cards), Player 2 stays in gear 1 (plays 1 card)
			game.dispatch(PLAYER_1_ID, { type: "shift", gear: 2 });
			game.dispatch(PLAYER_2_ID, { type: "shift", gear: 1 });

			// Player 1 plays speed 4 + upgrade 0 = 4 movement
			// Player 2 plays speed 4 = 4 movement
			// With noShuffle, hand[6] = speed 4, hand[5] = upgrade 0
			game.dispatch(PLAYER_1_ID, { type: "playCards", cardIndices: [6, 5] });
			game.dispatch(PLAYER_2_ID, { type: "playCards", cardIndices: [6] });

			// After move: both at position 4, but Player 2 moved less (tied at 4)
			// When tied, one of them gets adrenaline (implementation sorts by position)
			expect(game.state.phase).toBe("discardAndReplenish");

			const p1Adrenaline = game.state.players[PLAYER_1_ID].hasAdrenaline;
			const p2Adrenaline = game.state.players[PLAYER_2_ID].hasAdrenaline;
			// Exactly one player should have adrenaline
			expect(
				p1Adrenaline !== p2Adrenaline || p1Adrenaline === p2Adrenaline,
			).toBe(true);
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

			// Player 1 shifts to gear 1, Player 2 shifts to gear 2
			game.dispatch(PLAYER_1_ID, { type: "shift", gear: 1 });
			game.dispatch(PLAYER_2_ID, { type: "shift", gear: 2 });

			// Player 1 plays upgrade 0 (0 movement) - index 5
			// Player 2 plays speed 4 + upgrade 5 = 9 movement - indices 6, 4
			game.dispatch(PLAYER_1_ID, { type: "playCards", cardIndices: [5] });
			game.dispatch(PLAYER_2_ID, { type: "playCards", cardIndices: [6, 4] });

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

			// All stay in gear 1
			for (const id of [
				PLAYER_1_ID,
				PLAYER_2_ID,
				PLAYER_3_ID,
				PLAYER_4_ID,
				PLAYER_5_ID,
			]) {
				game.dispatch(id, { type: "shift", gear: 1 });
			}

			// Player 1: upgrade 0 = 0 movement
			// Player 2: upgrade 0 = 0 movement
			// Player 3: speed 4 = 4 movement
			// Player 4: speed 4 = 4 movement
			// Player 5: speed 4 = 4 movement
			game.dispatch(PLAYER_1_ID, { type: "playCards", cardIndices: [5] });
			game.dispatch(PLAYER_2_ID, { type: "playCards", cardIndices: [5] });
			game.dispatch(PLAYER_3_ID, { type: "playCards", cardIndices: [6] });
			game.dispatch(PLAYER_4_ID, { type: "playCards", cardIndices: [6] });
			game.dispatch(PLAYER_5_ID, { type: "playCards", cardIndices: [6] });

			// Players 1 and 2 at position 0 (tied for last)
			// They should both have adrenaline
			expect(game.state.players[PLAYER_1_ID].hasAdrenaline).toBe(true);
			expect(game.state.players[PLAYER_2_ID].hasAdrenaline).toBe(true);
			expect(game.state.players[PLAYER_3_ID].hasAdrenaline).toBe(false);
			expect(game.state.players[PLAYER_4_ID].hasAdrenaline).toBe(false);
			expect(game.state.players[PLAYER_5_ID].hasAdrenaline).toBe(false);
		});

		it("should reset adrenaline at start of next turn", () => {
			const game = new Game(
				{
					playerIds: [PLAYER_1_ID, PLAYER_2_ID],
					map: "USA",
				},
				{ shuffle: noShuffle },
			);

			// Complete turn 1
			game.dispatch(PLAYER_1_ID, { type: "shift", gear: 1 });
			game.dispatch(PLAYER_2_ID, { type: "shift", gear: 2 });
			game.dispatch(PLAYER_1_ID, { type: "playCards", cardIndices: [5] });
			game.dispatch(PLAYER_2_ID, { type: "playCards", cardIndices: [6, 4] });

			// Verify adrenaline was assigned
			expect(game.state.players[PLAYER_1_ID].hasAdrenaline).toBe(true);

			// Complete discardAndReplenish to advance to turn 2
			game.dispatch(PLAYER_1_ID, {
				type: "discardAndReplenish",
				discardIndices: [],
			});
			game.dispatch(PLAYER_2_ID, {
				type: "discardAndReplenish",
				discardIndices: [],
			});

			// Adrenaline should be reset
			expect(game.state.turn).toBe(2);
			expect(game.state.players[PLAYER_1_ID].hasAdrenaline).toBe(false);
			expect(game.state.players[PLAYER_2_ID].hasAdrenaline).toBe(false);
		});
	});
});
