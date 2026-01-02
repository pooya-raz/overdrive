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

				game._state.players[PLAYER_1_ID].engine = [];

				expect(() =>
					game.dispatch(PLAYER_1_ID, { type: "shift", gear: 3 }),
				).toThrow("Heat card required to shift by 2 gears");
			});
		});

		describe("playCards", () => {
			it("should move cards from hand to played", () => {
				const game = new Game({
					playerIds: [PLAYER_1_ID],
					map: "USA",
				});

				game.dispatch(PLAYER_1_ID, { type: "shift", gear: 2 });

				const handBefore = game.state.players[PLAYER_1_ID].hand;
				const cardsToBePlayed = [handBefore[1], handBefore[0]];

				game.dispatch(PLAYER_1_ID, { type: "playCards", cardIndices: [0, 1] });

				const player = game.state.players[PLAYER_1_ID];
				expect(player.played).toEqual(cardsToBePlayed);
				expect(player.hand).toHaveLength(5);
				expect(game.state.phase).toBe("discardAndReplenish");
			});

			it("should reject wrong number of cards", () => {
				const game = new Game({
					playerIds: [PLAYER_1_ID],
					map: "USA",
				});

				game.dispatch(PLAYER_1_ID, { type: "shift", gear: 2 });

				expect(() =>
					game.dispatch(PLAYER_1_ID, { type: "playCards", cardIndices: [0] }),
				).toThrow("Must play exactly 2 cards");
			});

			it("should reject invalid card index", () => {
				const game = new Game({
					playerIds: [PLAYER_1_ID],
					map: "USA",
				});

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
				const game = new Game({
					playerIds: [PLAYER_1_ID, PLAYER_2_ID],
					map: "USA",
				});

				expect(game.state.players[PLAYER_1_ID].position).toBe(0);
				expect(game.state.players[PLAYER_2_ID].position).toBe(0);
			});

			it("should move players based on played card values", () => {
				const game = new Game({
					playerIds: [PLAYER_1_ID],
					map: "USA",
				});

				const hand = game.state.players[PLAYER_1_ID].hand;
				const cardsWithValues = hand
					.map((card, index) => ({ card, index }))
					.filter((c) => c.card.value !== undefined);
				const card1 = cardsWithValues[0];
				const card2 = cardsWithValues[1];

				game.dispatch(PLAYER_1_ID, { type: "shift", gear: 2 });
				game.dispatch(PLAYER_1_ID, {
					type: "playCards",
					cardIndices: [card1.index, card2.index],
				});

				expect(game.state.players[PLAYER_1_ID].position).toBe(
					card1.card.value! + card2.card.value!,
				);
			});

			it("should auto-advance from move to discardAndReplenish", () => {
				const game = new Game({
					playerIds: [PLAYER_1_ID],
					map: "USA",
				});

				game.dispatch(PLAYER_1_ID, { type: "shift", gear: 1 });
				game.dispatch(PLAYER_1_ID, { type: "playCards", cardIndices: [0] });

				expect(game.state.phase).toBe("discardAndReplenish");
			});

			it("should accumulate position across turns", () => {
				const game = new Game({
					playerIds: [PLAYER_1_ID],
					map: "USA",
				});

				const hand1 = game.state.players[PLAYER_1_ID].hand;
				const firstCard = hand1
					.map((card, index) => ({ card, index }))
					.find((c) => c.card.value !== undefined)!;

				game.dispatch(PLAYER_1_ID, { type: "shift", gear: 1 });
				game.dispatch(PLAYER_1_ID, {
					type: "playCards",
					cardIndices: [firstCard.index],
				});

				expect(game.state.players[PLAYER_1_ID].position).toBe(
					firstCard.card.value,
				);

				game.dispatch(PLAYER_1_ID, {
					type: "discardAndReplenish",
					discardIndices: [],
				});

				const hand2 = game.state.players[PLAYER_1_ID].hand;
				const secondCard = hand2
					.map((card, index) => ({ card, index }))
					.find((c) => c.card.value !== undefined)!;

				game.dispatch(PLAYER_1_ID, { type: "shift", gear: 1 });
				game.dispatch(PLAYER_1_ID, {
					type: "playCards",
					cardIndices: [secondCard.index],
				});

				expect(game.state.players[PLAYER_1_ID].position).toBe(
					firstCard.card.value! + secondCard.card.value!,
				);
			});
		});
	});
});
