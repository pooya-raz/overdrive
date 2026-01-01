import { describe, expect, it } from "vitest";
import type { Card, Gear } from "./game-engine";
import { Player } from "./player";

function createPlayer(options: {
	id?: string;
	gear?: Gear;
	deck?: Card[];
	hand?: Card[];
	engine?: Card[];
	discard?: Card[];
}): Player {
	return new Player({
		id: options.id ?? "player-1",
		gear: options.gear ?? 1,
		deck: options.deck ?? [],
		hand: options.hand ?? [],
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
			expect(player.discard).toHaveLength(7);
			expect([...player.hand, ...player.deck]).toEqual(
				expect.arrayContaining(expectedCards),
			);
			expect(expectedCards).toEqual(
				expect.arrayContaining([...player.hand, ...player.deck]),
			);
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
});
