import type { Card, Gear } from "./game-engine";

function shuffle(cards: Card[]): Card[] {
	const shuffled = [...cards];

	for (let i = shuffled.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
	}

	return shuffled;
}

export class Player {
	id: string;
	gear: Gear;
	position: number;
	deck: Card[];
	hand: Card[];
	played: Card[];
	engine: Card[];
	discard: Card[];

	constructor(options: {
		id: string;
		gear: Gear;
		position: number;
		deck: Card[];
		hand: Card[];
		played: Card[];
		engine: Card[];
		discard: Card[];
	}) {
		this.id = options.id;
		this.gear = options.gear;
		this.position = options.position;
		this.deck = options.deck;
		this.hand = options.hand;
		this.played = options.played;
		this.engine = options.engine;
		this.discard = options.discard;
	}

	draw(): void {
		while (this.hand.length < 7) {
			if (this.deck.length === 0) {
				if (this.discard.length === 0) {
					throw new Error("No cards left to draw (deck and discard empty).");
				}
				this.deck = shuffle(this.discard);
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

	move(): void {
		const spaces = this.played.reduce((sum, card) => {
			if (card.type === "stress") {
				return sum;
			}
			return sum + (card.value ?? 0);
		}, 0);
		this.position += spaces;
	}
}
