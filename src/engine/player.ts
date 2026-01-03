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

export interface PlayerState {
	id: string;
	gear: Gear;
	position: number;
	deck: Card[];
	hand: Card[];
	played: Card[];
	engine: Card[];
	discard: Card[];
}

export class Player {
	readonly id: string;
	private _gear: Gear;
	private _position: number;
	private _deck: Card[];
	private _hand: Card[];
	private _played: Card[];
	private _engine: Card[];
	private _discard: Card[];
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
		this._gear = options.gear;
		this._position = options.position;
		this._deck = shuffle(options.deck);
		this._hand = options.hand;
		this._played = options.played;
		this._engine = options.engine;
		this._discard = options.discard;
		// Non-enumerable so structuredClone doesn't try to clone the function
		Object.defineProperty(this, "shuffle", {
			value: shuffle,
			enumerable: false,
		});
	}

	get state(): PlayerState {
		return structuredClone({
			id: this.id,
			gear: this._gear,
			position: this._position,
			deck: this._deck,
			hand: this._hand,
			played: this._played,
			engine: this._engine,
			discard: this._discard,
		});
	}

	/** @internal Test only - set position directly */
	_setPosition(position: number): void {
		this._position = position;
	}

	/** @internal Test only - set engine directly */
	_setEngine(engine: Card[]): void {
		this._engine = engine;
	}

	draw(): void {
		while (this._hand.length < 7) {
			if (this._deck.length === 0) {
				if (this._discard.length === 0) {
					throw new Error("No cards left to draw (deck and discard empty).");
				}
				this._deck = this.shuffle(this._discard);
				this._discard = [];
			}
			const card = this._deck.pop();
			if (card) this._hand.push(card);
		}
	}

	shift(nextGear: Gear): void {
		const diff = Math.abs(nextGear - this._gear);

		if (diff > 2) {
			throw new Error("Can only shift up or down by max 2 gears");
		}

		if (diff === 2) {
			const heatIndex = this._engine.findIndex((card) => card.type === "heat");
			if (heatIndex === -1) {
				throw new Error("Heat card required to shift by 2 gears");
			}
			const [heat] = this._engine.splice(heatIndex, 1);
			this._discard.push(heat);
		}

		this._gear = nextGear;
	}

	discardAndReplenish(discardIndices: number[]): void {
		const sortedIndices = [...discardIndices].sort((a, b) => b - a);
		for (const index of sortedIndices) {
			if (index < 0 || index >= this._hand.length) {
				throw new Error(`Invalid card index: ${index}`);
			}
			const card = this._hand[index];
			if (card.type === "heat") {
				throw new Error("Cannot discard heat cards");
			}
			if (card.type === "stress") {
				throw new Error("Cannot discard stress cards");
			}
			this._discard.push(...this._hand.splice(index, 1));
		}

		this._discard.push(...this._played);
		this._played = [];
		this.draw();
	}

	playCards(cardIndices: number[]): void {
		if (cardIndices.length !== this._gear) {
			throw new Error(`Must play exactly ${this._gear} cards`);
		}

		// Sort descending: removing lower indices first would shift higher ones
		const sortedIndices = [...cardIndices].sort((a, b) => b - a);
		for (const index of sortedIndices) {
			if (index < 0 || index >= this._hand.length) {
				throw new Error(`Invalid card index: ${index}`);
			}
			const [card] = this._hand.splice(index, 1);
			this._played.push(card);
		}
	}

	/**
	 * Draws a single card from deck. Shuffles discard into deck if needed.
	 * Returns undefined if no cards available.
	 */
	private drawOne(): Card | undefined {
		if (this._deck.length === 0) {
			if (this._discard.length === 0) {
				return undefined;
			}
			this._deck = this.shuffle(this._discard);
			this._discard = [];
		}
		return this._deck.pop();
	}

	/**
	 * Resolves stress cards in played array by drawing replacements.
	 * Speed/upgrade cards go to played; stress/heat cards go to discard.
	 */
	private resolveStressCards(): void {
		const stressCount = this._played.filter((c) => c.type === "stress").length;

		for (let i = 0; i < stressCount; i++) {
			const drawn = this.drawOne();
			if (!drawn) continue;

			const destination =
				drawn.type === "stress" || drawn.type === "heat"
					? this._discard
					: this._played;
			destination.push(drawn);
		}
	}

	/**
	 * Pays heat by moving cards from engine to discard.
	 * Returns actual heat paid (may be less if engine runs out).
	 */
	payHeat(amount: number): number {
		let paid = 0;
		while (paid < amount && this._engine.length > 0) {
			const heat = this._engine.pop();
			if (heat) {
				this._discard.push(heat);
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
		const speed = this._played.reduce(
			(sum, card) => sum + (card.value ?? 0),
			0,
		);
		const startPosition = this._position;
		this._position += speed;

		if (!track) return;

		for (const corner of track.corners) {
			const crossed =
				startPosition < corner.position && corner.position <= this._position;
			if (!crossed) continue;

			const penalty = speed - corner.speedLimit;
			if (penalty > 0) this.payHeat(penalty);
		}
	}
}
