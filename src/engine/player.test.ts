import { describe, expect, it } from "vitest";
import type { Card, Gear } from "./game-engine";
import { Player } from "./player";

function createPlayer(options: {
	id?: string;
	gear?: Gear;
	deck?: Card[];
	hand?: Card[];
	played?: Card[];
	engine?: Card[];
	discard?: Card[];
}): Player {
	return new Player({
		id: options.id ?? "player-1",
		gear: options.gear ?? 1,
		deck: options.deck ?? [],
		hand: options.hand ?? [],
		played: options.played ?? [],
		engine: options.engine ?? [],
		discard: options.discard ?? [],
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
			const expectedCards = [...deck];
			const player = createPlayer({ deck });

			player.draw();

			expect(player.hand).toHaveLength(7);
			expect(player.deck).toHaveLength(0);
			expect([...player.hand, ...player.deck]).toEqual(
				expect.arrayContaining(expectedCards),
			);
			expect(expectedCards).toEqual(
				expect.arrayContaining([...player.hand, ...player.deck]),
			);
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
			const expectedCards = [...discard];
			const player = createPlayer({ deck: [], discard });

			player.draw();

			expect(player.hand).toHaveLength(7);
			expect(player.deck).toHaveLength(0);
			expect(player.discard).toHaveLength(0);
			expect(player.hand).toEqual(expect.arrayContaining(expectedCards));
			expect(expectedCards).toEqual(expect.arrayContaining(player.hand));
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
});
