import { Player, type PlayerData, type ShuffleFn } from "./player";

export { Player, type PlayerData, type ShuffleFn };

export type GameMap = "USA";

export interface CreateGameRequest {
	playerIds: string[];
	map: GameMap;
}

export type Gear = 1 | 2 | 3 | 4;

export type CardType = "speed" | "heat" | "stress" | "upgrade";

export interface Card {
	type: CardType;
	value?: number;
}

export interface Corner {
	position: number;
	speedLimit: number;
}

export interface Track {
	length: number;
	corners: Corner[];
}

const STARTING_SPEED_CARDS: Card[] = [
	{ type: "speed", value: 1 },
	{ type: "speed", value: 1 },
	{ type: "speed", value: 1 },
	{ type: "speed", value: 2 },
	{ type: "speed", value: 2 },
	{ type: "speed", value: 2 },
	{ type: "speed", value: 3 },
	{ type: "speed", value: 3 },
	{ type: "speed", value: 3 },
	{ type: "speed", value: 4 },
	{ type: "speed", value: 4 },
	{ type: "speed", value: 4 },
];

const STARTING_UPGRADE_CARDS: Card[] = [
	{ type: "upgrade", value: 0 },
	{ type: "upgrade", value: 5 },
	{ type: "heat" },
];

function createStressCards(count: number): Card[] {
	return Array.from({ length: count }, () => ({ type: "stress" }));
}

function createHeatCards(count: number): Card[] {
	return Array.from({ length: count }, () => ({ type: "heat" }));
}

export type GamePhase = "planning" | "resolution";

export type TurnState =
	| "plan"
	| "revealAndMove"
	| "adrenaline"
	| "react"
	| "slipstream"
	| "checkCorner"
	| "discard"
	| "replenishHand";

export type ReactChoice = "cooldown" | "boost" | "skip";

export type Action =
	| { type: "plan"; gear: Gear; cardIndices: number[] }
	| { type: "adrenaline"; acceptMove: boolean; acceptCooldown: boolean }
	| { type: "react"; action: ReactChoice; amount?: number }
	| { type: "slipstream"; distance: 0 | 1 | 2 }
	| { type: "discard"; cardIndices: number[] };

export interface GameState {
	map: GameMap;
	players: Record<string, PlayerData>;
	turn: number;
	phase: GamePhase;
	currentState: TurnState;
	// For planning phase: tracks which players have acted
	pendingPlayers: Record<string, boolean>;
	// For resolution phase: player order and current player
	turnOrder: string[];
	currentPlayerIndex: number;
	// For react state: which reactions are still available
	availableReactions: ("cooldown" | "boost")[];
}

interface MapConfig {
	stressCards: number;
	heatCards: number;
	track: Track;
}

const MAP_CONFIG: Record<GameMap, MapConfig> = {
	USA: {
		stressCards: 3,
		heatCards: 6,
		track: {
			length: 24,
			corners: [
				{ position: 6, speedLimit: 4 },
				{ position: 15, speedLimit: 3 },
			],
		},
	},
};

function createStartingDeck(map: GameMap): Card[] {
	const config = MAP_CONFIG[map];
	return [
		...STARTING_SPEED_CARDS,
		...STARTING_UPGRADE_CARDS,
		...createStressCards(config.stressCards),
	];
}

function createStartingEngine(map: GameMap): Card[] {
	const config = MAP_CONFIG[map];
	return createHeatCards(config.heatCards);
}

export interface GameOptions {
	shuffle?: ShuffleFn;
}

function parseCreateGameRequest(
	request: CreateGameRequest,
	options: GameOptions = {},
): Record<string, Player> {
	if (new Set(request.playerIds).size !== request.playerIds.length) {
		throw new Error("Player IDs must be unique");
	}
	const players: Record<string, Player> = {};
	for (let i = 0; i < request.playerIds.length; i++) {
		const id = request.playerIds[i];
		// Stagger starting positions: 2 players per position, first on raceline
		const position = -Math.floor(i / 2);
		const onRaceline = i % 2 === 0;
		players[id] = new Player({
			id,
			gear: 1,
			position,
			onRaceline,
			deck: createStartingDeck(request.map),
			hand: [],
			played: [],
			engine: createStartingEngine(request.map),
			discard: [],
			shuffle: options.shuffle,
		});
	}
	return players;
}

interface InternalGameState {
	map: GameMap;
	players: Record<string, Player>;
	turn: number;
	phase: GamePhase;
	currentState: TurnState;
	pendingPlayers: Record<string, boolean>;
	turnOrder: string[];
	currentPlayerIndex: number;
	availableReactions: ("cooldown" | "boost")[];
}

export class Game {
	private _state: InternalGameState;

	constructor(request: CreateGameRequest, options: GameOptions = {}) {
		const players = parseCreateGameRequest(request, options);
		for (const player of Object.values(players)) {
			player.draw();
		}
		this._state = {
			map: request.map,
			players,
			turn: 1,
			phase: "planning",
			currentState: "plan",
			pendingPlayers: Object.fromEntries(
				Object.keys(players).map((id) => [id, true]),
			),
			turnOrder: [],
			currentPlayerIndex: 0,
			availableReactions: [],
		};
	}

	get state(): GameState {
		return {
			map: this._state.map,
			players: Object.fromEntries(
				Object.entries(this._state.players).map(([id, player]) => [
					id,
					player.state,
				]),
			),
			turn: this._state.turn,
			phase: this._state.phase,
			currentState: this._state.currentState,
			pendingPlayers: { ...this._state.pendingPlayers },
			turnOrder: [...this._state.turnOrder],
			currentPlayerIndex: this._state.currentPlayerIndex,
			availableReactions: [...this._state.availableReactions],
		};
	}

	dispatch(playerId: string, action: Action): void {
		if (action.type !== this._state.currentState) {
			throw new Error(`Invalid action for state ${this._state.currentState}`);
		}

		const player = this._state.players[playerId];
		if (!player) {
			throw new Error("Player not found");
		}

		if (this._state.phase === "planning") {
			this.handlePlanningAction(playerId, player, action);
		} else {
			this.handleResolutionAction(playerId, player, action);
		}
	}

	private handlePlanningAction(
		playerId: string,
		player: Player,
		action: Action,
	): void {
		if (!this._state.pendingPlayers[playerId]) {
			throw new Error("Player has already acted this state");
		}

		if (action.type !== "plan") {
			throw new Error(`Action ${action.type} not valid in planning phase`);
		}

		player.shiftGears(action.gear);
		player.playCards(action.cardIndices);

		this._state.pendingPlayers[playerId] = false;

		const allActed = Object.values(this._state.pendingPlayers).every((v) => !v);
		if (allActed) {
			this.enterResolutionPhase();
		}
	}

	private handleResolutionAction(
		playerId: string,
		player: Player,
		action: Action,
	): void {
		const currentPlayerId =
			this._state.turnOrder[this._state.currentPlayerIndex];
		if (playerId !== currentPlayerId) {
			throw new Error("Not your turn");
		}

		switch (action.type) {
			case "adrenaline": {
				// TODO: Apply adrenaline bonuses
				break;
			}
			case "react": {
				if (action.action === "skip") {
					break; // Advance to next state
				}

				if (!this._state.availableReactions.includes(action.action)) {
					throw new Error(`Reaction ${action.action} not available`);
				}

				// TODO: Apply cooldown/boost based on action.action and action.amount

				this._state.availableReactions = this._state.availableReactions.filter(
					(r) => r !== action.action,
				);

				if (this._state.availableReactions.length > 0) {
					return; // Stay in react state for more actions
				}
				break;
			}
			case "slipstream": {
				// TODO: Apply slipstream movement
				break;
			}
			case "discard": {
				player.discard(action.cardIndices);
				break;
			}
			default:
				throw new Error(`Action ${action.type} not valid in resolution phase`);
		}

		this.advanceResolutionState();
	}

	private enterResolutionPhase(): void {
		this.resetAdrenaline();
		this._state.phase = "resolution";
		this._state.turnOrder = this.getPlayersInRaceOrder().map((p) => p.id);
		this._state.currentPlayerIndex = 0;
		this._state.currentState = "revealAndMove";
		this.runAutoStates();
	}

	private advanceResolutionState(): void {
		const stateOrder: TurnState[] = [
			"revealAndMove",
			"adrenaline",
			"react",
			"slipstream",
			"checkCorner",
			"discard",
			"replenishHand",
		];
		const currentIndex = stateOrder.indexOf(this._state.currentState);
		const nextIndex = currentIndex + 1;

		if (nextIndex >= stateOrder.length) {
			this.advanceToNextPlayer();
		} else {
			this._state.currentState = stateOrder[nextIndex];
			this.runAutoStates();
		}
	}

	private advanceToNextPlayer(): void {
		this._state.currentPlayerIndex++;

		if (this._state.currentPlayerIndex >= this._state.turnOrder.length) {
			this.endResolutionPhase();
		} else {
			this._state.currentState = "revealAndMove";
			this.runAutoStates();
		}
	}

	private endResolutionPhase(): void {
		this.assignAdrenaline();
		this._state.phase = "planning";
		this._state.currentState = "plan";
		this._state.turn += 1;
		this._state.turnOrder = [];
		this._state.currentPlayerIndex = 0;
		this.resetPendingPlayers();
	}

	/** Executes automatic states until reaching an input state. */
	private runAutoStates(): void {
		const autoStates: TurnState[] = [
			"revealAndMove",
			"checkCorner",
			"replenishHand",
		];

		while (autoStates.includes(this._state.currentState)) {
			this.executeAutoState();

			const stateOrder: TurnState[] = [
				"revealAndMove",
				"adrenaline",
				"react",
				"slipstream",
				"checkCorner",
				"discard",
				"replenishHand",
			];
			const currentIndex = stateOrder.indexOf(this._state.currentState);
			const nextIndex = currentIndex + 1;

			if (nextIndex >= stateOrder.length) {
				this.advanceToNextPlayer();
				return;
			}
			this._state.currentState = stateOrder[nextIndex];
		}

		// Initialize available reactions when entering react state
		if (this._state.currentState === "react") {
			this._state.availableReactions = ["cooldown", "boost"];
		}
	}

	private executeAutoState(): void {
		const playerId = this._state.turnOrder[this._state.currentPlayerIndex];
		const player = this._state.players[playerId];
		const track = MAP_CONFIG[this._state.map].track;

		switch (this._state.currentState) {
			case "revealAndMove": {
				const targetPosition = player.move(track);
				player.setPosition(targetPosition);
				// TODO: Proper collision resolution
				break;
			}
			case "checkCorner": {
				// Corner handling is currently in player.move()
				// TODO: Split out corner logic
				break;
			}
			case "replenishHand": {
				player.replenishHand();
				break;
			}
		}
	}

	private resetPendingPlayers(): void {
		this._state.pendingPlayers = Object.fromEntries(
			Object.keys(this._state.players).map((id) => [id, true]),
		);
	}

	/** Returns players sorted by race position, leader first. */
	private getPlayersInRaceOrder(): Player[] {
		const players = Object.values(this._state.players);
		return [...players].sort((a, b) => {
			const positionDiff = b.state.position - a.state.position;
			if (positionDiff !== 0) {
				return positionDiff;
			}
			return a.state.onRaceline ? -1 : 1;
		});
	}

	private resetAdrenaline(): void {
		for (const player of Object.values(this._state.players)) {
			player.setAdrenaline(false);
		}
	}

	private assignAdrenaline(): void {
		const raceOrder = this.getPlayersInRaceOrder();
		const adrenalineSlots = raceOrder.length >= 5 ? 2 : 1;

		// Trailing players (end of race order) get adrenaline
		for (let i = 0; i < adrenalineSlots; i++) {
			const player = raceOrder[raceOrder.length - 1 - i];
			player.setAdrenaline(true);
		}
	}
}
