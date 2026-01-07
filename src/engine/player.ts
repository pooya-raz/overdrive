import { createStartingDeck, createStartingEngine } from "./cards";
import type {
	Card,
	Corner,
	GameMap,
	Gear,
	PlayerData,
	ReactChoice,
	ShuffleFn,
} from "./types";

export type { PlayerData, ShuffleFn };

export const defaultShuffle: ShuffleFn = (items) => {
	const shuffled = [...items];

	for (let i = shuffled.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
	}

	return shuffled;
};

export class PlayerBuilder {
	private _id = "";
	private _position = 0;
	private _onRaceline = true;
	private _deck: Card[] = [];
	private _engine: Card[] = [];
	private _shuffle?: ShuffleFn;

	id(id: string): this {
		this._id = id;
		return this;
	}

	position(position: number): this {
		this._position = position;
		return this;
	}

	onRaceline(onRaceline: boolean): this {
		this._onRaceline = onRaceline;
		return this;
	}

	/** Sets starting deck and engine based on map configuration. */
	map(map: GameMap): this {
		this._deck = createStartingDeck(map);
		this._engine = createStartingEngine(map);
		return this;
	}

	shuffle(shuffle: ShuffleFn): this {
		this._shuffle = shuffle;
		return this;
	}

	build(): Player {
		if (!this._id) {
			throw new Error("Player id is required");
		}
		return new Player({
			id: this._id,
			gear: 1,
			position: this._position,
			onRaceline: this._onRaceline,
			deck: this._deck,
			hand: [],
			played: [],
			engine: this._engine,
			discard: [],
			shuffle: this._shuffle,
		});
	}
}

export class Player {
	static builder(): PlayerBuilder {
		return new PlayerBuilder();
	}
	readonly id: string;
	private _gear: Gear;
	private _position: number;
	private _onRaceline: boolean;
	private _deck: Card[];
	private _hand: Card[];
	private _played: Card[];
	private _engine: Card[];
	private _discard: Card[];
	private _hasAdrenaline: boolean;
	private _startPosition: number;
	private _cardSpeed: number;
	private _availableCooldowns: number;
	private _availableReactions: ("cooldown" | "boost")[];
	private declare shuffle: ShuffleFn;

	constructor(options: {
		id: string;
		gear: Gear;
		position: number;
		onRaceline?: boolean;
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
		this._onRaceline = options.onRaceline ?? true;
		this._deck = shuffle(options.deck);
		this._hand = options.hand;
		this._played = options.played;
		this._engine = options.engine;
		this._discard = options.discard;
		this._hasAdrenaline = false;
		this._startPosition = 0;
		this._cardSpeed = 0;
		this._availableCooldowns = 0;
		this._availableReactions = [];
		// Non-enumerable so structuredClone doesn't try to clone the function
		Object.defineProperty(this, "shuffle", {
			value: shuffle,
			enumerable: false,
		});
	}

	/** Returns a deep copy of player state to prevent external mutation. */
	get state(): PlayerData {
		return structuredClone({
			id: this.id,
			gear: this._gear,
			position: this._position,
			onRaceline: this._onRaceline,
			deck: this._deck,
			hand: this._hand,
			played: this._played,
			engine: this._engine,
			discard: this._discard,
			hasAdrenaline: this._hasAdrenaline,
		});
	}

	/**
	 * Adrenaline helps trailing players catch up. Players in last position
	 * (or last 2 in 5+ player games) gain adrenaline after movement, granting
	 * +1 speed and +1 cooldown during the React phase. Resets each turn.
	 */
	setAdrenaline(value: boolean): void {
		this._hasAdrenaline = value;
	}

	/** Players on the raceline go first when sharing a position. */
	setRaceline(onRaceline: boolean): void {
		this._onRaceline = onRaceline;
	}

	/** Sets final track position after collision resolution. */
	setPosition(position: number): void {
		this._position = position;
	}

	/** Moves heat cards from hand back to engine. */
	cooldown(amount: number): void {
		for (let i = 0; i < amount; i++) {
			const heatIndex = this._hand.findIndex((c) => c.type === "heat");
			if (heatIndex === -1) break;
			const [heat] = this._hand.splice(heatIndex, 1);
			this._engine.push(heat);
		}
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

	/** Shifting by 2 gears costs 1 heat (moved from engine to discard). */
	shiftGears(nextGear: Gear): void {
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

	/** Heat and stress cards cannot be discarded from hand. Moves played to discard. */
	discard(discardIndices: number[]): void {
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
	}

	/** Number of cards played must equal current gear. */
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

	/** Initializes turn state, calculates movement, and sets position. Called at start of resolution. */
	beginResolution(): void {
		this._startPosition = this._position;
		this._availableCooldowns = 0;
		this._availableReactions = ["boost"];
		this.resolveStressCards();
		this._cardSpeed = this.calculateSpeed();
		this._position = this._startPosition + this._cardSpeed;
	}

	addAdrenalineMove(): void {
		this._position++;
		this._cardSpeed++;
	}

	addCooldown(amount: number): void {
		this._availableCooldowns += amount;
		if (!this._availableReactions.includes("cooldown")) {
			this._availableReactions.unshift("cooldown");
		}
	}

	react(action: ReactChoice): boolean {
		if (action === "skip") {
			this._availableReactions = [];
			return true;
		}
		if (!this._availableReactions.includes(action)) {
			throw new Error(`Reaction ${action} not available`);
		}
		if (action === "cooldown") {
			this.cooldown(1);
			this._availableCooldowns--;
			if (this._availableCooldowns <= 0) {
				this._availableReactions = this._availableReactions.filter(
					(r) => r !== "cooldown",
				);
			}
		} else {
			// Remove non-cooldown reactions after use (boost can only be used once)
			this._availableReactions = this._availableReactions.filter(
				(r) => r !== action,
			);
		}
		return this._availableReactions.length === 0;
	}

	checkCorners(corners: Corner[]): void {
		const crossedCorners = corners.filter(
			(c) => this._startPosition < c.position && c.position <= this._position,
		);
		for (const corner of crossedCorners) {
			const penalty = this._cardSpeed - corner.speedLimit;
			if (penalty <= 0) continue;
			const paid = this.payHeat(penalty);
			if (paid < penalty) {
				this.spinOut(corner.position);
				break;
			}
		}
	}

	private calculateSpeed(): number {
		return this._played.reduce((sum, card) => sum + (card.value ?? 0), 0);
	}

	/** Handles spinout: adds stress cards, resets gear, sets position before corner. */
	spinOut(cornerPosition: number): void {
		const stressCount = this._gear <= 2 ? 1 : 2;
		for (let i = 0; i < stressCount; i++) {
			this._hand.push({ type: "stress" });
		}
		this._gear = 1;
		this._position = cornerPosition - 1;
	}
}
