import { describe, expect, it } from "vitest";
import { Player, type ShuffleFn } from "./player";
import type { Card, Corner, Gear } from "./types";

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
			player.draw();
			results.push(JSON.stringify(player.state.hand));
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

			expect(player.state.deckSize).toBe(0);
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

			expect(player.state.deckSize).toBe(0);
			expect(player.state.discardSize).toBe(0);
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

	describe("shiftGears", () => {
		it("updates gear when shifting by 1", () => {
			const player = createPlayer({ gear: 2 });

			player.shiftGears(3);

			expect(player.state.gear).toBe(3);
		});

		it("pays heat when shifting by 2 gears", () => {
			const player = createPlayer({
				gear: 1,
				engine: [{ type: "heat" }],
				discard: [],
			});

			player.shiftGears(3);

			expect(player.state.gear).toBe(3);
			expect(player.state.engineSize).toBe(0);
			expect(player.state.discardSize).toBe(1);
			expect(player.state.discardTop).toEqual({ type: "heat" });
		});

		describe("validation", () => {
			it("throws when shifting by 2 without heat in engine", () => {
				const player = createPlayer({ gear: 1, engine: [] });

				expect(() => player.shiftGears(3)).toThrow(
					"Heat card required to shift by 2 gears",
				);
			});

			it("throws when shifting by more than 2 gears", () => {
				const player = createPlayer({ gear: 1, engine: [{ type: "heat" }] });

				expect(() => player.shiftGears(4)).toThrow(
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

			expect(player.state.playedCount).toBe(2);
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

	describe("beginResolution", () => {
		it("sets position to sum of starting position and played card values", () => {
			const player = createPlayer({
				position: 0,
				played: [
					{ type: "speed", value: 3 },
					{ type: "speed", value: 2 },
				],
			});

			player.beginResolution();

			expect(player.state.position).toBe(5);
		});

		it("accumulates position from starting position", () => {
			const player = createPlayer({
				position: 10,
				played: [{ type: "speed", value: 3 }],
			});

			player.beginResolution();

			expect(player.state.position).toBe(13);
		});

		it("includes upgrade card values", () => {
			const player = createPlayer({
				position: 0,
				played: [
					{ type: "speed", value: 2 },
					{ type: "upgrade", value: 5 },
				],
			});

			player.beginResolution();

			expect(player.state.position).toBe(7);
		});

		it("treats heat cards as 0 movement", () => {
			const player = createPlayer({
				position: 0,
				played: [{ type: "speed", value: 3 }, { type: "heat" }],
			});

			player.beginResolution();

			expect(player.state.position).toBe(3);
		});

		it("keeps position unchanged when no cards played", () => {
			const player = createPlayer({ position: 5, played: [] });

			player.beginResolution();

			expect(player.state.position).toBe(5);
		});

		describe("stress card resolution", () => {
			it("draws speed card and adds to played", () => {
				const player = createPlayer({
					position: 0,
					played: [{ type: "stress" }],
					deck: [{ type: "speed", value: 3 }],
				});

				player.beginResolution();

				expect(player.state.playedCount).toBe(2);
				expect(player.state.position).toBe(3);
			});

			it("draws upgrade card and adds to played", () => {
				const player = createPlayer({
					position: 0,
					played: [{ type: "stress" }],
					deck: [{ type: "upgrade", value: 5 }],
				});

				player.beginResolution();

				expect(player.state.playedCount).toBe(2);
				expect(player.state.position).toBe(5);
			});

			it("discards drawn stress or heat cards", () => {
				const player = createPlayer({
					position: 0,
					played: [{ type: "stress" }],
					deck: [{ type: "stress" }],
					discard: [],
				});

				player.beginResolution();

				expect(player.state.discardSize).toBe(1);
				expect(player.state.discardTop).toEqual({ type: "stress" });
				expect(player.state.position).toBe(0);
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

				player.beginResolution();

				expect(player.state.position).toBe(5);
			});

			it("shuffles discard into deck when deck is empty", () => {
				const player = createPlayer({
					position: 0,
					played: [{ type: "stress" }],
					deck: [],
					discard: [{ type: "speed", value: 4 }],
				});

				player.beginResolution();

				expect(player.state.position).toBe(4);
				expect(player.state.discardSize).toBe(0);
			});

			it("keeps starting position when deck and discard empty", () => {
				const player = createPlayer({
					position: 5,
					played: [{ type: "stress" }],
					deck: [],
					discard: [],
				});

				player.beginResolution();

				expect(player.state.position).toBe(5);
			});
		});
	});

	describe("spinOut", () => {
		it("adds 1 stress card when in gear 1 or 2", () => {
			const player = createPlayer({ gear: 2, hand: [], position: 10 });

			player.spinOut(5);

			expect(player.state.hand).toEqual([{ type: "stress" }]);
		});

		it("adds 2 stress cards when in gear 3 or 4", () => {
			const player = createPlayer({ gear: 4, hand: [], position: 10 });

			player.spinOut(5);

			expect(player.state.hand).toEqual([
				{ type: "stress" },
				{ type: "stress" },
			]);
		});

		it("resets gear to 1", () => {
			const player = createPlayer({ gear: 4, position: 10 });

			player.spinOut(5);

			expect(player.state.gear).toBe(1);
		});

		it("sets position to corner position - 1", () => {
			const player = createPlayer({ position: 10 });

			player.spinOut(5);

			expect(player.state.position).toBe(4);
		});
	});

	describe("discard", () => {
		it("moves played cards to discard", () => {
			const player = createPlayer({
				played: [
					{ type: "speed", value: 1 },
					{ type: "speed", value: 2 },
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

			player.discard([]);

			expect(player.state.playedCount).toBe(0);
			expect(player.state.discardSize).toBe(2);
			expect(player.state.discardTop).toEqual({ type: "speed", value: 2 });
		});

		it("allows discarding speed and upgrade cards from hand", () => {
			const player = createPlayer({
				played: [],
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

			player.discard([0, 1]);

			expect(player.state.discardSize).toBe(2);
			expect(player.state.discardTop).toEqual({ type: "speed", value: 1 });
			expect(player.state.hand).toHaveLength(5);
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

				expect(() => player.discard([0])).toThrow("Cannot discard heat cards");
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

				expect(() => player.discard([0])).toThrow(
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

				expect(() => player.discard([99])).toThrow("Invalid card index: 99");
			});
		});
	});

	describe("draw (at end of turn)", () => {
		it("draws cards to fill hand to 7", () => {
			const player = createPlayer({
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
			});

			player.draw();

			expect(player.state.hand).toHaveLength(7);
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
			expect(player.state.engineSize).toBe(1);
			expect(player.state.discardSize).toBe(2);
		});

		it("returns actual amount paid when engine runs out", () => {
			const player = createPlayer({
				engine: [{ type: "heat" }],
				discard: [],
			});

			const paid = player.payHeat(5);

			expect(paid).toBe(1);
			expect(player.state.engineSize).toBe(0);
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

	describe("cooldown", () => {
		it("moves heat cards from hand to engine", () => {
			const player = createPlayer({
				hand: [
					{ type: "speed", value: 1 },
					{ type: "heat" },
					{ type: "speed", value: 2 },
				],
				engine: [],
			});

			player.cooldown(1);

			expect(player.state.hand).toEqual([
				{ type: "speed", value: 1 },
				{ type: "speed", value: 2 },
			]);
			expect(player.state.engineSize).toBe(1);
		});

		it("moves multiple heat cards", () => {
			const player = createPlayer({
				hand: [{ type: "heat" }, { type: "speed", value: 1 }, { type: "heat" }],
				engine: [],
			});

			player.cooldown(2);

			expect(player.state.hand).toEqual([{ type: "speed", value: 1 }]);
			expect(player.state.engineSize).toBe(2);
		});

		it("stops when no heat cards left in hand", () => {
			const player = createPlayer({
				hand: [{ type: "heat" }, { type: "speed", value: 1 }],
				engine: [],
			});

			player.cooldown(3);

			expect(player.state.hand).toEqual([{ type: "speed", value: 1 }]);
			expect(player.state.engineSize).toBe(1);
		});

		it("does nothing when no heat in hand", () => {
			const player = createPlayer({
				hand: [
					{ type: "speed", value: 1 },
					{ type: "speed", value: 2 },
				],
				engine: [],
			});

			player.cooldown(1);

			expect(player.state.hand).toHaveLength(2);
			expect(player.state.engineSize).toBe(0);
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

	describe("react", () => {
		it("skip returns true", () => {
			const player = createPlayer({ played: [{ type: "speed", value: 4 }] });
			player.beginResolution();

			const done = player.react("skip");

			expect(done).toBe(true);
		});

		it("cooldown moves heat from hand to engine", () => {
			const player = createPlayer({
				played: [{ type: "speed", value: 4 }],
				hand: [{ type: "heat" }],
				engine: [],
			});
			player.beginResolution();
			player.addCooldown(1);

			player.react("cooldown");

			expect(player.state.hand).toEqual([]);
			expect(player.state.engineSize).toBe(1);
		});

		it("cooldown returns true when no reactions remaining", () => {
			const player = createPlayer({
				played: [{ type: "speed", value: 4 }],
				hand: [{ type: "heat" }],
			});
			player.beginResolution();
			player.addCooldown(1);
			player.react("boost");

			const done = player.react("cooldown");

			expect(done).toBe(true);
		});

		it("cooldown returns false when boost still available", () => {
			const player = createPlayer({
				played: [{ type: "speed", value: 4 }],
				hand: [{ type: "heat" }],
			});
			player.beginResolution();
			player.addCooldown(1);

			const done = player.react("cooldown");

			expect(done).toBe(false);
		});

		it("throws when cooldown not available", () => {
			const player = createPlayer({
				played: [{ type: "speed", value: 4 }],
				hand: [{ type: "heat" }],
			});
			player.beginResolution();
			player.addCooldown(1);
			player.react("cooldown");

			expect(() => player.react("cooldown")).toThrow(
				"Reaction cooldown not available",
			);
		});

		it("throws when cooldown not added", () => {
			const player = createPlayer({ played: [{ type: "speed", value: 4 }] });
			player.beginResolution();

			expect(() => player.react("cooldown")).toThrow(
				"Reaction cooldown not available",
			);
		});

		it("throws when boost not available", () => {
			const player = createPlayer({ played: [{ type: "speed", value: 4 }] });
			player.beginResolution();
			player.react("boost");

			expect(() => player.react("boost")).toThrow(
				"Reaction boost not available",
			);
		});
	});

	describe("checkCorners", () => {
		const corner: Corner = { position: 5, speedLimit: 4 };

		it("pays heat when crossing corner over speed limit", () => {
			const player = createPlayer({
				position: 0,
				played: [
					{ type: "speed", value: 4 },
					{ type: "speed", value: 4 },
				],
				engine: [
					{ type: "heat" },
					{ type: "heat" },
					{ type: "heat" },
					{ type: "heat" },
					{ type: "heat" },
					{ type: "heat" },
				],
			});

			player.beginResolution();
			player.checkCorners([corner]);

			expect(player.state.engineSize).toBe(2);
			expect(player.state.discardSize).toBe(4);
		});

		it("does not pay heat when at speed limit", () => {
			const player = createPlayer({
				position: 0,
				played: [{ type: "speed", value: 4 }],
				engine: [{ type: "heat" }, { type: "heat" }],
			});

			player.beginResolution();
			player.checkCorners([corner]);

			expect(player.state.engineSize).toBe(2);
		});

		it("does not pay heat when under speed limit", () => {
			const player = createPlayer({
				position: 0,
				played: [{ type: "speed", value: 3 }],
				engine: [{ type: "heat" }, { type: "heat" }],
			});

			player.beginResolution();
			player.checkCorners([corner]);

			expect(player.state.engineSize).toBe(2);
		});

		it("spins out when not enough heat to pay penalty", () => {
			const player = createPlayer({
				gear: 3,
				position: 0,
				played: [
					{ type: "speed", value: 3 },
					{ type: "speed", value: 3 },
					{ type: "speed", value: 3 },
				],
				engine: [{ type: "heat" }],
				hand: [],
			});

			player.beginResolution();
			player.checkCorners([corner]);

			expect(player.state.position).toBe(4);
			expect(player.state.gear).toBe(1);
			expect(player.state.hand.filter((c) => c.type === "stress")).toHaveLength(
				2,
			);
		});

		it("counts adrenaline move toward corner speed", () => {
			const player = createPlayer({
				position: 0,
				played: [{ type: "speed", value: 4 }],
				engine: [{ type: "heat" }, { type: "heat" }],
			});

			player.beginResolution();
			player.addAdrenalineMove();
			player.checkCorners([corner]);

			expect(player.state.engineSize).toBe(1);
		});

		it("does not count position changes after beginResolution toward corner speed", () => {
			const player = createPlayer({
				position: 0,
				played: [{ type: "speed", value: 4 }],
				engine: [{ type: "heat" }, { type: "heat" }],
			});

			player.beginResolution();
			player.setPosition(player.state.position + 2);
			player.checkCorners([corner]);

			expect(player.state.engineSize).toBe(2);
		});

		it("does not check corners not crossed", () => {
			const player = createPlayer({
				position: 0,
				played: [{ type: "speed", value: 4 }],
				engine: [{ type: "heat" }, { type: "heat" }],
			});
			const farCorner: Corner = { position: 20, speedLimit: 2 };

			player.beginResolution();
			player.checkCorners([farCorner]);

			expect(player.state.engineSize).toBe(2);
		});

		it("checks multiple corners in order", () => {
			const player = createPlayer({
				position: 0,
				played: [
					{ type: "speed", value: 4 },
					{ type: "speed", value: 4 },
					{ type: "speed", value: 4 },
				],
				engine: [
					{ type: "heat" },
					{ type: "heat" },
					{ type: "heat" },
					{ type: "heat" },
					{ type: "heat" },
					{ type: "heat" },
					{ type: "heat" },
				],
			});
			const corners: Corner[] = [
				{ position: 5, speedLimit: 10 },
				{ position: 10, speedLimit: 8 },
			];

			player.beginResolution();
			player.checkCorners(corners);

			expect(player.state.engineSize).toBe(1);
		});
	});
});
