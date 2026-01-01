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
	deck: Card[];
	hand: Card[];
	engine: Card[];
	discard: Card[];

	constructor(options: {
		id: string;
		gear: Gear;
		deck: Card[];
		hand: Card[];
		engine: Card[];
		discard: Card[];
	}) {
		this.id = options.id;
		this.gear = options.gear;
		this.deck = options.deck;
		this.hand = options.hand;
		this.engine = options.engine;
		this.discard = options.discard;
	}

	draw(): void {
		while (this.hand.length < 7) {
			// If deck empty, refill from discard
			if (this.deck.length === 0) {
				if (this.discard.length === 0) {
					throw new Error("No cards left to draw (deck and discard empty).");
				}
				this.deck = shuffle(this.discard);
			}

			const c = this.deck.pop();
			if (!c) break; // safety
			this.hand.push(c);
		}

		if (this.hand.length < 7) {
			throw new Error(`Could only draw ${this.hand.length} cards.`);
		}
	}

	shift(nextGear: Gear): void {
		const diff = nextGear - this.gear;
		if (![-1, 0, 1].includes(diff)) {
			throw new Error("Can only shift up or down by 1 gear");
		}
		this.gear = nextGear;
	}
}
