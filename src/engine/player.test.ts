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

			expect(player.deck).toHaveLength(0);
			// Cards are popped from end of deck
			expect(player.hand).toEqual([
				{ type: "heat" },
				{ type: "upgrade", value: 5 },
				{ type: "upgrade", value: 0 },
				{ type: "speed", value: 4 },
				{ type: "speed", value: 3 },
				{ type: "speed", value: 2 },
				{ type: "speed", value: 1 },
			]);
		});

		it("draws from discard when the deck is empty", () => {
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

			expect(player.deck).toHaveLength(0);
			expect(player.discard).toHaveLength(0);
			// Discard becomes deck, cards popped from end
			expect(player.hand).toEqual([
				{ type: "heat" },
				{ type: "upgrade", value: 5 },
				{ type: "upgrade", value: 0 },
				{ type: "speed", value: 4 },
				{ type: "speed", value: 3 },
				{ type: "speed", value: 2 },
				{ type: "speed", value: 1 },
			]);
		});

		it("throws when there are not enough cards to reach 7", () => {
			const player = createPlayer({
				deck: [
					{ type: "speed", value: 1 },
					{ type: "speed", value: 2 },
					{ type: "speed", value: 3 },
				],
				discard: [],
			});

			expect(() => player.draw()).toThrow(
				"No cards left to draw (deck and discard empty).",
			);
		});
	});

	describe("shift", () => {
		it("updates gear when shifting by 1", () => {
			const player = createPlayer({ gear: 2 });

			player.shift(3);

			expect(player.gear).toBe(3);
		});

		it("allows shifting by 2 when a heat card is available", () => {
			const player = createPlayer({
				gear: 1,
				engine: [{ type: "heat" }],
				discard: [],
			});

			player.shift(3);

			expect(player.gear).toBe(3);
			expect(player.engine).toHaveLength(0);
			expect(player.discard).toEqual([{ type: "heat" }]);
		});

		it("throws when shifting more than 1 gear without heat card in engine", () => {
			const player = createPlayer({ gear: 1, engine: [], discard: [] });

			expect(() => player.shift(3)).toThrow(
				"Heat card required to shift by 2 gears",
			);
		});

		it("rejects shifting by 3 gears", () => {
			const player = createPlayer({ gear: 1, engine: [{ type: "heat" }] });

			expect(() => player.shift(4)).toThrow(
				"Can only shift up or down by max 2 gears",
			);
		});
	});

	describe("discardAndReplenish", () => {
		it("moves played cards to discard and draws new hand", () => {
			const played: Card[] = [
				{ type: "speed", value: 1 },
				{ type: "speed", value: 2 },
			];
			const deck: Card[] = [
				{ type: "speed", value: 3 },
				{ type: "speed", value: 4 },
			];
			const hand: Card[] = [
				{ type: "upgrade", value: 0 },
				{ type: "upgrade", value: 5 },
				{ type: "heat" },
				{ type: "stress" },
				{ type: "stress" },
			];
			const player = createPlayer({ played, deck, hand, discard: [] });

			player.discardAndReplenish([]);

			expect(player.played).toEqual([]);
			expect(player.discard).toEqual([
				{ type: "speed", value: 1 },
				{ type: "speed", value: 2 },
			]);
			expect(player.hand).toHaveLength(7);
		});

		it("allows discarding speed and upgrade cards from hand", () => {
			const hand: Card[] = [
				{ type: "speed", value: 1 },
				{ type: "upgrade", value: 5 },
				{ type: "heat" },
				{ type: "stress" },
				{ type: "speed", value: 2 },
				{ type: "speed", value: 3 },
				{ type: "speed", value: 4 },
			];
			const deck: Card[] = [
				{ type: "speed", value: 1 },
				{ type: "speed", value: 2 },
			];
			const player = createPlayer({ played: [], deck, hand, discard: [] });

			player.discardAndReplenish([0, 1]);

			expect(player.discard).toEqual([
				{ type: "upgrade", value: 5 },
				{ type: "speed", value: 1 },
			]);
			expect(player.hand).toHaveLength(7);
		});

		it("rejects discarding heat cards", () => {
			const hand: Card[] = [
				{ type: "heat" },
				{ type: "speed", value: 1 },
				{ type: "speed", value: 2 },
				{ type: "speed", value: 3 },
				{ type: "speed", value: 4 },
				{ type: "upgrade", value: 0 },
				{ type: "upgrade", value: 5 },
			];
			const player = createPlayer({ played: [], deck: [], hand, discard: [] });

			expect(() => player.discardAndReplenish([0])).toThrow(
				"Cannot discard heat cards",
			);
		});

		it("rejects discarding stress cards", () => {
			const hand: Card[] = [
				{ type: "stress" },
				{ type: "speed", value: 1 },
				{ type: "speed", value: 2 },
				{ type: "speed", value: 3 },
				{ type: "speed", value: 4 },
				{ type: "upgrade", value: 0 },
				{ type: "upgrade", value: 5 },
			];
			const player = createPlayer({ played: [], deck: [], hand, discard: [] });

			expect(() => player.discardAndReplenish([0])).toThrow(
				"Cannot discard stress cards",
			);
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

			expect(player.played).toEqual([
				{ type: "speed", value: 2 },
				{ type: "speed", value: 1 },
			]);
			expect(player.hand).toEqual([{ type: "speed", value: 3 }]);
		});

		it("throws when card count does not match gear", () => {
			const hand: Card[] = [
				{ type: "speed", value: 1 },
				{ type: "speed", value: 2 },
				{ type: "speed", value: 3 },
			];
			const player = createPlayer({ gear: 2, hand });

			expect(() => player.playCards([0])).toThrow("Must play exactly 2 cards");
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

			expect(() => player.playCards([0, -1])).toThrow("Invalid card index: -1");
		});
	});

	describe("move", () => {
		it("moves by sum of played card values", () => {
			const played: Card[] = [
				{ type: "speed", value: 3 },
				{ type: "speed", value: 2 },
			];
			const player = createPlayer({ position: 0, played });

			player.move();

			expect(player.position).toBe(5);
		});

		it("treats heat cards as 0 movement", () => {
			const played: Card[] = [{ type: "speed", value: 3 }, { type: "heat" }];
			const player = createPlayer({ position: 0, played });

			player.move();

			expect(player.position).toBe(3);
		});

		describe("stress card resolution", () => {
			it("draws speed card and adds to played", () => {
				const player = createPlayer({
					position: 0,
					played: [{ type: "stress" }],
					deck: [{ type: "speed", value: 3 }],
				});

				player.move();

				expect(player.played).toContainEqual({ type: "speed", value: 3 });
				expect(player.deck).toHaveLength(0);
				expect(player.position).toBe(3);
			});

			it("draws upgrade card and adds to played", () => {
				const player = createPlayer({
					position: 0,
					played: [{ type: "stress" }],
					deck: [{ type: "upgrade", value: 5 }],
				});

				player.move();

				expect(player.played).toContainEqual({ type: "upgrade", value: 5 });
				expect(player.position).toBe(5);
			});

			it("draws stress card and adds to discard", () => {
				const player = createPlayer({
					position: 0,
					played: [{ type: "stress" }],
					deck: [{ type: "stress" }],
					discard: [],
				});

				player.move();

				expect(player.discard).toContainEqual({ type: "stress" });
				expect(player.position).toBe(0);
			});

			it("draws heat card and adds to discard", () => {
				const player = createPlayer({
					position: 0,
					played: [{ type: "stress" }],
					deck: [{ type: "heat" }],
					discard: [],
				});

				player.move();

				expect(player.discard).toContainEqual({ type: "heat" });
				expect(player.position).toBe(0);
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

				player.move();

				expect(player.position).toBe(5);
				expect(player.deck).toHaveLength(0);
			});

			it("shuffles discard into deck when deck is empty", () => {
				const player = createPlayer({
					position: 0,
					played: [{ type: "stress" }],
					deck: [],
					discard: [{ type: "speed", value: 4 }],
				});

				player.move();

				expect(player.position).toBe(4);
				expect(player.discard).toHaveLength(0);
			});

			it("handles empty deck and discard gracefully", () => {
				const player = createPlayer({
					position: 5,
					played: [{ type: "stress" }],
					deck: [],
					discard: [],
				});

				player.move();

				expect(player.position).toBe(5);
			});

			it("combines stress resolution with normal card values", () => {
				const player = createPlayer({
					position: 0,
					played: [{ type: "speed", value: 3 }, { type: "stress" }],
					deck: [{ type: "speed", value: 2 }],
				});

				player.move();

				expect(player.position).toBe(5);
			});
		});

		it("treats stress cards as 0 movement when no deck", () => {
			const played: Card[] = [{ type: "speed", value: 4 }, { type: "stress" }];
			const player = createPlayer({
				position: 0,
				played,
				deck: [],
				discard: [],
			});

			player.move();

			expect(player.position).toBe(4);
		});

		it("includes upgrade card values", () => {
			const played: Card[] = [
				{ type: "speed", value: 2 },
				{ type: "upgrade", value: 5 },
			];
			const player = createPlayer({ position: 0, played });

			player.move();

			expect(player.position).toBe(7);
		});

		it("does not move when no cards played", () => {
			const player = createPlayer({ position: 5, played: [] });

			player.move();

			expect(player.position).toBe(5);
		});

		it("accumulates position from starting position", () => {
			const played: Card[] = [{ type: "speed", value: 3 }];
			const player = createPlayer({ position: 10, played });

			player.move();

			expect(player.position).toBe(13);
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

				player.move(track);

				expect(player.position).toBe(6);
				// Speed 4 - limit 3 = 1 heat
				expect(player.engine).toHaveLength(2);
				expect(player.discard).toEqual([{ type: "heat" }]);
			});

			it("does not pay heat when at or under speed limit", () => {
				const player = createPlayer({
					position: 2,
					played: [{ type: "speed", value: 3 }],
					engine: [{ type: "heat" }, { type: "heat" }],
					discard: [],
				});

				player.move(track);

				expect(player.position).toBe(5);
				expect(player.engine).toHaveLength(2);
				expect(player.discard).toEqual([]);
			});

			it("does not check corner when not crossed", () => {
				const player = createPlayer({
					position: 0,
					played: [{ type: "speed", value: 4 }],
					engine: [{ type: "heat" }],
					discard: [],
				});

				player.move(track);

				expect(player.position).toBe(4);
				expect(player.engine).toHaveLength(1);
			});

			it("pays heat for multiple corners crossed", () => {
				const player = createPlayer({
					position: 4,
					played: [
						{ type: "speed", value: 4 },
						{ type: "upgrade", value: 8 },
					],
					engine: Array(10).fill({ type: "heat" }),
					discard: [],
				});

				player.move(track);

				expect(player.position).toBe(16);
				// Corner at 5: speed 12 - limit 3 = 9 heat
				// Corner at 15: speed 12 - limit 2 = 10 heat
				// Total: 19 heat, but only 10 available
				expect(player.engine).toHaveLength(0);
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
			expect(player.engine).toHaveLength(1);
			expect(player.discard).toHaveLength(2);
		});

		it("returns actual amount paid when engine runs out", () => {
			const player = createPlayer({
				engine: [{ type: "heat" }],
				discard: [],
			});

			const paid = player.payHeat(5);

			expect(paid).toBe(1);
			expect(player.engine).toHaveLength(0);
			expect(player.discard).toHaveLength(1);
		});

		it("returns 0 when engine is empty", () => {
			const player = createPlayer({
				engine: [],
				discard: [],
			});

			const paid = player.payHeat(3);

			expect(paid).toBe(0);
			expect(player.discard).toHaveLength(0);
		});
	});
});
