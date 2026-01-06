import { describe, expect, it } from "vitest";
import type { Card, Gear } from "./game-engine";
import { Player, type ShuffleFn } from "./player";

const noShuffle: ShuffleFn = <T>(items: T[]) => items;

function createPlayer(
	options: {
		id?: string;
		gear?: Gear;
		position?: number;
		deck?: Card[];
		hand?: Card[];
		played?: Card[];
		engine?: Card[];
		discard?: Card[];
		shuffle?: ShuffleFn;
	} = {},
): Player {
	return new Player({
		id: options.id ?? "player-1",
		gear: options.gear ?? 1,
		position: options.position ?? 0,
		deck: options.deck ?? [],
		hand: options.hand ?? [],
		played: options.played ?? [],
		engine: options.engine ?? [],
		discard: options.discard ?? [],
		shuffle: options.shuffle ?? noShuffle,
	});
}

describe("defaultShuffle", () => {
	it("is used when no shuffle option is provided", () => {
		const deck: Card[] = Array.from({ length: 10 }, (_, i) => ({
			type: "speed",
			value: (i % 4) + 1,
		})) as Card[];
		const results: string[] = [];

		for (let i = 0; i < 10; i++) {
			const player = new Player({
				id: "test",
				gear: 1,
				position: 0,
				deck: [...deck],
				hand: [],
				played: [],
				engine: [],
				discard: [],
			});
			results.push(JSON.stringify(player.state.deck));
		}

		const uniqueResults = new Set(results);
		expect(uniqueResults.size).toBeGreaterThan(1);
	});
});

describe("Player", () => {
	describe("draw", () => {
		it("fills the hand to 7 cards from the deck", () => {
			const deck: Card[] = [
				{ type: "speed", value: 1 },
				{ type: "speed", value: 2 },
				{ type: "speed", value: 3 },
				{ type: "speed", value: 4 },
				{ type: "upgrade", value: 0 },
				{ type: "upgrade", value: 5 },
				{ type: "heat" },
			];
			const player = createPlayer({ deck });

			player.draw();

			expect(player.state.deck).toHaveLength(0);
			expect(player.state.hand).toEqual([
				{ type: "heat" },
				{ type: "upgrade", value: 5 },
				{ type: "upgrade", value: 0 },
				{ type: "speed", value: 4 },
				{ type: "speed", value: 3 },
				{ type: "speed", value: 2 },
				{ type: "speed", value: 1 },
			]);
		});

		it("shuffles discard into deck when deck is empty", () => {
			const discard: Card[] = [
				{ type: "speed", value: 1 },
				{ type: "speed", value: 2 },
				{ type: "speed", value: 3 },
				{ type: "speed", value: 4 },
				{ type: "upgrade", value: 0 },
				{ type: "upgrade", value: 5 },
				{ type: "heat" },
			];
			const player = createPlayer({ deck: [], discard, shuffle: noShuffle });

			player.draw();

			expect(player.state.deck).toHaveLength(0);
			expect(player.state.discard).toHaveLength(0);
			expect(player.state.hand).toHaveLength(7);
		});

		describe("validation", () => {
			it("throws when not enough cards to reach 7", () => {
				const player = createPlayer({
					deck: [{ type: "speed", value: 1 }],
					discard: [],
				});

				expect(() => player.draw()).toThrow(
					"No cards left to draw (deck and discard empty).",
				);
			});
		});
	});

	describe("shift", () => {
		it("updates gear when shifting by 1", () => {
			const player = createPlayer({ gear: 2 });

			player.shift(3);

			expect(player.state.gear).toBe(3);
		});

		it("pays heat when shifting by 2 gears", () => {
			const player = createPlayer({
				gear: 1,
				engine: [{ type: "heat" }],
				discard: [],
			});

			player.shift(3);

			expect(player.state.gear).toBe(3);
			expect(player.state.engine).toHaveLength(0);
			expect(player.state.discard).toEqual([{ type: "heat" }]);
		});

		describe("validation", () => {
			it("throws when shifting by 2 without heat in engine", () => {
				const player = createPlayer({ gear: 1, engine: [] });

				expect(() => player.shift(3)).toThrow(
					"Heat card required to shift by 2 gears",
				);
			});

			it("throws when shifting by more than 2 gears", () => {
				const player = createPlayer({ gear: 1, engine: [{ type: "heat" }] });

				expect(() => player.shift(4)).toThrow(
					"Can only shift up or down by max 2 gears",
				);
			});
		});
	});

	describe("playCards", () => {
		it("moves cards from hand to played", () => {
			const hand: Card[] = [
				{ type: "speed", value: 1 },
				{ type: "speed", value: 2 },
				{ type: "speed", value: 3 },
			];
			const player = createPlayer({ gear: 2, hand });

			player.playCards([0, 1]);

			expect(player.state.played).toEqual([
				{ type: "speed", value: 2 },
				{ type: "speed", value: 1 },
			]);
			expect(player.state.hand).toEqual([{ type: "speed", value: 3 }]);
		});

		describe("validation", () => {
			it("throws when card count does not match gear", () => {
				const hand: Card[] = [
					{ type: "speed", value: 1 },
					{ type: "speed", value: 2 },
				];
				const player = createPlayer({ gear: 2, hand });

				expect(() => player.playCards([0])).toThrow(
					"Must play exactly 2 cards",
				);
			});

			it("throws on invalid card index", () => {
				const hand: Card[] = [
					{ type: "speed", value: 1 },
					{ type: "speed", value: 2 },
				];
				const player = createPlayer({ gear: 2, hand });

				expect(() => player.playCards([0, 5])).toThrow("Invalid card index: 5");
			});

			it("throws on negative card index", () => {
				const hand: Card[] = [
					{ type: "speed", value: 1 },
					{ type: "speed", value: 2 },
				];
				const player = createPlayer({ gear: 2, hand });

				expect(() => player.playCards([0, -1])).toThrow(
					"Invalid card index: -1",
				);
			});
		});
	});

	describe("move", () => {
		it("returns target position as sum of played card values", () => {
			const player = createPlayer({
				position: 0,
				played: [
					{ type: "speed", value: 3 },
					{ type: "speed", value: 2 },
				],
			});

			const targetPosition = player.move();

			expect(targetPosition).toBe(5);
		});

		it("accumulates position from starting position", () => {
			const player = createPlayer({
				position: 10,
				played: [{ type: "speed", value: 3 }],
			});

			const targetPosition = player.move();

			expect(targetPosition).toBe(13);
		});

		it("includes upgrade card values", () => {
			const player = createPlayer({
				position: 0,
				played: [
					{ type: "speed", value: 2 },
					{ type: "upgrade", value: 5 },
				],
			});

			const targetPosition = player.move();

			expect(targetPosition).toBe(7);
		});

		it("treats heat cards as 0 movement", () => {
			const player = createPlayer({
				position: 0,
				played: [{ type: "speed", value: 3 }, { type: "heat" }],
			});

			const targetPosition = player.move();

			expect(targetPosition).toBe(3);
		});

		it("returns starting position when no cards played", () => {
			const player = createPlayer({ position: 5, played: [] });

			const targetPosition = player.move();

			expect(targetPosition).toBe(5);
		});

		describe("stress card resolution", () => {
			it("draws speed card and adds to played", () => {
				const player = createPlayer({
					position: 0,
					played: [{ type: "stress" }],
					deck: [{ type: "speed", value: 3 }],
				});

				const targetPosition = player.move();

				expect(player.state.played).toContainEqual({
					type: "speed",
					value: 3,
				});
				expect(targetPosition).toBe(3);
			});

			it("draws upgrade card and adds to played", () => {
				const player = createPlayer({
					position: 0,
					played: [{ type: "stress" }],
					deck: [{ type: "upgrade", value: 5 }],
				});

				const targetPosition = player.move();

				expect(player.state.played).toContainEqual({
					type: "upgrade",
					value: 5,
				});
				expect(targetPosition).toBe(5);
			});

			it("discards drawn stress or heat cards", () => {
				const player = createPlayer({
					position: 0,
					played: [{ type: "stress" }],
					deck: [{ type: "stress" }],
					discard: [],
				});

				const targetPosition = player.move();

				expect(player.state.discard).toContainEqual({ type: "stress" });
				expect(targetPosition).toBe(0);
			});

			it("resolves multiple stress cards", () => {
				const player = createPlayer({
					position: 0,
					played: [{ type: "stress" }, { type: "stress" }],
					deck: [
						{ type: "speed", value: 2 },
						{ type: "speed", value: 3 },
					],
				});

				const targetPosition = player.move();

				expect(targetPosition).toBe(5);
			});

			it("shuffles discard into deck when deck is empty", () => {
				const player = createPlayer({
					position: 0,
					played: [{ type: "stress" }],
					deck: [],
					discard: [{ type: "speed", value: 4 }],
				});

				const targetPosition = player.move();

				expect(targetPosition).toBe(4);
				expect(player.state.discard).toHaveLength(0);
			});

			it("returns starting position when deck and discard empty", () => {
				const player = createPlayer({
					position: 5,
					played: [{ type: "stress" }],
					deck: [],
					discard: [],
				});

				const targetPosition = player.move();

				expect(targetPosition).toBe(5);
			});
		});
	});

	describe("corner checking", () => {
		const track = {
			length: 20,
			corners: [
				{ position: 5, speedLimit: 3 },
				{ position: 15, speedLimit: 2 },
			],
		};

		it("pays heat when crossing corner over speed limit", () => {
			const player = createPlayer({
				position: 2,
				played: [{ type: "speed", value: 4 }],
				engine: [{ type: "heat" }, { type: "heat" }, { type: "heat" }],
				discard: [],
			});

			const targetPosition = player.move(track);

			expect(targetPosition).toBe(6);
			expect(player.state.engine).toHaveLength(2);
			expect(player.state.discard).toEqual([{ type: "heat" }]);
		});

		it("does not pay heat when at or under speed limit", () => {
			const player = createPlayer({
				position: 2,
				played: [{ type: "speed", value: 3 }],
				engine: [{ type: "heat" }, { type: "heat" }],
				discard: [],
			});

			const targetPosition = player.move(track);

			expect(targetPosition).toBe(5);
			expect(player.state.engine).toHaveLength(2);
		});

		it("does not check corner when not crossed", () => {
			const player = createPlayer({
				position: 0,
				played: [{ type: "speed", value: 4 }],
				engine: [{ type: "heat" }],
				discard: [],
			});

			const targetPosition = player.move(track);

			expect(targetPosition).toBe(4);
			expect(player.state.engine).toHaveLength(1);
		});

		it("pays heat for multiple corners crossed", () => {
			const player = createPlayer({
				position: 4,
				played: [
					{ type: "speed", value: 4 },
					{ type: "upgrade", value: 8 },
				],
				// Corner at 5: 12 - 3 = 9 heat, Corner at 15: 12 - 2 = 10 heat
				engine: Array(19).fill({ type: "heat" }),
				discard: [],
			});

			const targetPosition = player.move(track);

			expect(targetPosition).toBe(16);
			expect(player.state.engine).toHaveLength(0);
		});

		it("spins out when not enough heat to pay for corner", () => {
			const player = createPlayer({
				position: 2,
				gear: 2,
				hand: [],
				played: [
					{ type: "speed", value: 2 },
					{ type: "speed", value: 3 },
				],
				engine: [{ type: "heat" }],
				discard: [],
			});

			const targetPosition = player.move(track);

			// Returns position before corner (5 - 1 = 4)
			expect(targetPosition).toBe(4);
			// Pays all available heat
			expect(player.state.engine).toHaveLength(0);
			expect(player.state.discard).toEqual([{ type: "heat" }]);
			// Gear reset to 1
			expect(player.state.gear).toBe(1);
			// 1 stress card for 1st/2nd gear
			expect(player.state.hand).toEqual([{ type: "stress" }]);
		});

		it("spins out with 2 stress cards when in 3rd/4th gear", () => {
			const player = createPlayer({
				position: 2,
				gear: 4,
				hand: [],
				played: [
					{ type: "speed", value: 4 },
					{ type: "speed", value: 4 },
				],
				engine: [{ type: "heat" }],
				discard: [],
			});

			const targetPosition = player.move(track);

			expect(targetPosition).toBe(4);
			expect(player.state.gear).toBe(1);
			// 2 stress cards for 3rd/4th gear
			expect(player.state.hand).toEqual([
				{ type: "stress" },
				{ type: "stress" },
			]);
		});
	});

	describe("discardAndReplenish", () => {
		it("moves played cards to discard and draws new hand", () => {
			const player = createPlayer({
				played: [
					{ type: "speed", value: 1 },
					{ type: "speed", value: 2 },
				],
				deck: [
					{ type: "speed", value: 3 },
					{ type: "speed", value: 4 },
				],
				hand: [
					{ type: "upgrade", value: 0 },
					{ type: "upgrade", value: 5 },
					{ type: "heat" },
					{ type: "stress" },
					{ type: "stress" },
				],
				discard: [],
			});

			player.discardAndReplenish([]);

			expect(player.state.played).toEqual([]);
			expect(player.state.discard).toEqual([
				{ type: "speed", value: 1 },
				{ type: "speed", value: 2 },
			]);
			expect(player.state.hand).toHaveLength(7);
		});

		it("allows discarding speed and upgrade cards from hand", () => {
			const player = createPlayer({
				played: [],
				deck: [
					{ type: "speed", value: 1 },
					{ type: "speed", value: 2 },
				],
				hand: [
					{ type: "speed", value: 1 },
					{ type: "upgrade", value: 5 },
					{ type: "heat" },
					{ type: "stress" },
					{ type: "speed", value: 2 },
					{ type: "speed", value: 3 },
					{ type: "speed", value: 4 },
				],
				discard: [],
			});

			player.discardAndReplenish([0, 1]);

			expect(player.state.discard).toEqual([
				{ type: "upgrade", value: 5 },
				{ type: "speed", value: 1 },
			]);
			expect(player.state.hand).toHaveLength(7);
		});

		describe("validation", () => {
			it("throws when discarding heat cards", () => {
				const player = createPlayer({
					played: [],
					deck: [],
					hand: [
						{ type: "heat" },
						{ type: "speed", value: 1 },
						{ type: "speed", value: 2 },
						{ type: "speed", value: 3 },
						{ type: "speed", value: 4 },
						{ type: "upgrade", value: 0 },
						{ type: "upgrade", value: 5 },
					],
				});

				expect(() => player.discardAndReplenish([0])).toThrow(
					"Cannot discard heat cards",
				);
			});

			it("throws when discarding stress cards", () => {
				const player = createPlayer({
					played: [],
					deck: [],
					hand: [
						{ type: "stress" },
						{ type: "speed", value: 1 },
						{ type: "speed", value: 2 },
						{ type: "speed", value: 3 },
						{ type: "speed", value: 4 },
						{ type: "upgrade", value: 0 },
						{ type: "upgrade", value: 5 },
					],
				});

				expect(() => player.discardAndReplenish([0])).toThrow(
					"Cannot discard stress cards",
				);
			});

			it("throws on invalid card index", () => {
				const player = createPlayer({
					played: [],
					deck: [],
					hand: [
						{ type: "speed", value: 1 },
						{ type: "speed", value: 2 },
					],
				});

				expect(() => player.discardAndReplenish([99])).toThrow(
					"Invalid card index: 99",
				);
			});
		});
	});

	describe("payHeat", () => {
		it("moves heat cards from engine to discard", () => {
			const player = createPlayer({
				engine: [{ type: "heat" }, { type: "heat" }, { type: "heat" }],
				discard: [],
			});

			const paid = player.payHeat(2);

			expect(paid).toBe(2);
			expect(player.state.engine).toHaveLength(1);
			expect(player.state.discard).toHaveLength(2);
		});

		it("returns actual amount paid when engine runs out", () => {
			const player = createPlayer({
				engine: [{ type: "heat" }],
				discard: [],
			});

			const paid = player.payHeat(5);

			expect(paid).toBe(1);
			expect(player.state.engine).toHaveLength(0);
		});

		it("returns 0 when engine is empty", () => {
			const player = createPlayer({
				engine: [],
				discard: [],
			});

			const paid = player.payHeat(3);

			expect(paid).toBe(0);
		});
	});

	describe("setAdrenaline", () => {
		it("sets adrenaline to true", () => {
			const player = createPlayer();

			player.setAdrenaline(true);

			expect(player.state.hasAdrenaline).toBe(true);
		});

		it("sets adrenaline to false", () => {
			const player = createPlayer();
			player.setAdrenaline(true);

			player.setAdrenaline(false);

			expect(player.state.hasAdrenaline).toBe(false);
		});

		it("initializes with adrenaline false", () => {
			const player = createPlayer();

			expect(player.state.hasAdrenaline).toBe(false);
		});
	});
});
