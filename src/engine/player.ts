import type { Card, Gear, Track } from "./game-engine";

export type ShuffleFn = <T>(items: T[]) => T[];

export const defaultShuffle: ShuffleFn = (items) => {
	const shuffled = [...items];

	for (let i = shuffled.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
	}

	return shuffled;
};

export class Player {
	id: string;
	gear: Gear;
	position: number;
	deck: Card[];
	hand: Card[];
	played: Card[];
	engine: Card[];
	discard: Card[];
	private declare shuffle: ShuffleFn;

	constructor(options: {
		id: string;
		gear: Gear;
		position: number;
		deck: Card[];
		hand: Card[];
		played: Card[];
		engine: Card[];
		discard: Card[];
		shuffle?: ShuffleFn;
	}) {
		const shuffle = options.shuffle ?? defaultShuffle;
		this.id = options.id;
		this.gear = options.gear;
		this.position = options.position;
		this.deck = shuffle(options.deck);
		this.hand = options.hand;
		this.played = options.played;
		this.engine = options.engine;
		this.discard = options.discard;
		// Non-enumerable so structuredClone doesn't try to clone the function
		Object.defineProperty(this, "shuffle", {
			value: shuffle,
			enumerable: false,
		});
	}

	draw(): void {
		while (this.hand.length < 7) {
			if (this.deck.length === 0) {
				if (this.discard.length === 0) {
					throw new Error("No cards left to draw (deck and discard empty).");
				}
				this.deck = this.shuffle(this.discard);
				this.discard = [];
			}
			const card = this.deck.pop();
			if (card) this.hand.push(card);
		}
	}

	shift(nextGear: Gear): void {
		const diff = Math.abs(nextGear - this.gear);

		if (diff > 2) {
			throw new Error("Can only shift up or down by max 2 gears");
		}

		if (diff === 2) {
			const heatIndex = this.engine.findIndex((card) => card.type === "heat");
			if (heatIndex === -1) {
				throw new Error("Heat card required to shift by 2 gears");
			}
			const [heat] = this.engine.splice(heatIndex, 1);
			this.discard.push(heat);
		}

		this.gear = nextGear;
	}

	discardAndReplenish(discardIndices: number[]): void {
		const sortedIndices = [...discardIndices].sort((a, b) => b - a);
		for (const index of sortedIndices) {
			if (index < 0 || index >= this.hand.length) {
				throw new Error(`Invalid card index: ${index}`);
			}
			const card = this.hand[index];
			if (card.type === "heat") {
				throw new Error("Cannot discard heat cards");
			}
			if (card.type === "stress") {
				throw new Error("Cannot discard stress cards");
			}
			this.discard.push(...this.hand.splice(index, 1));
		}

		this.discard.push(...this.played);
		this.played = [];
		this.draw();
	}

	playCards(cardIndices: number[]): void {
		if (cardIndices.length !== this.gear) {
			throw new Error(`Must play exactly ${this.gear} cards`);
		}

		// Sort descending: removing lower indices first would shift higher ones
		const sortedIndices = [...cardIndices].sort((a, b) => b - a);
		for (const index of sortedIndices) {
			if (index < 0 || index >= this.hand.length) {
				throw new Error(`Invalid card index: ${index}`);
			}
			const [card] = this.hand.splice(index, 1);
			this.played.push(card);
		}
	}

	/**
	 * Draws a single card from deck. Shuffles discard into deck if needed.
	 * Returns undefined if no cards available.
	 */
	private drawOne(): Card | undefined {
		if (this.deck.length === 0) {
			if (this.discard.length === 0) {
				return undefined;
			}
			this.deck = this.shuffle(this.discard);
			this.discard = [];
		}
		return this.deck.pop();
	}

	/**
	 * Resolves stress cards in played array by drawing replacements.
	 * Speed/upgrade cards go to played; stress/heat cards go to discard.
	 */
	private resolveStressCards(): void {
		const stressCount = this.played.filter((c) => c.type === "stress").length;

		for (let i = 0; i < stressCount; i++) {
			const drawn = this.drawOne();
			if (!drawn) continue;

			const destination =
				drawn.type === "stress" || drawn.type === "heat"
					? this.discard
					: this.played;
			destination.push(drawn);
		}
	}

	/**
	 * Pays heat by moving cards from engine to discard.
	 * Returns actual heat paid (may be less if engine runs out).
	 */
	payHeat(amount: number): number {
		let paid = 0;
		while (paid < amount && this.engine.length > 0) {
			const heat = this.engine.pop();
			if (heat) {
				this.discard.push(heat);
				paid++;
			}
		}
		return paid;
	}

	/**
	 * Resolves stress cards, then calculates and applies movement.
	 * If track provided, checks corners and applies heat penalties.
	 */
	move(track?: Track): void {
		this.resolveStressCards();
		const speed = this.played.reduce((sum, card) => sum + (card.value ?? 0), 0);
		const startPosition = this.position;
		this.position += speed;

		if (!track) return;

		for (const corner of track.corners) {
			const crossed =
				startPosition < corner.position && corner.position <= this.position;
			if (!crossed) continue;

			const penalty = speed - corner.speedLimit;
			if (penalty > 0) this.payHeat(penalty);
		}
	}
}
