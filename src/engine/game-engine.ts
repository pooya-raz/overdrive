import { Player, type ShuffleFn } from "./player";

export { Player, type ShuffleFn };

export type Map = "USA";

export interface CreateGameRequest {
	playerIds: string[];
	map: Map;
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

export type Phase = "shift" | "playCards" | "move" | "discardAndReplenish";

export type Action =
	| { type: "shift"; gear: Gear }
	| { type: "playCards"; cardIndices: number[] }
	| { type: "discardAndReplenish"; discardIndices: number[] };

export interface GameState {
	map: Map;
	players: Record<string, Player>;
	turn: number;
	phase: Phase;
	pendingPlayers: Record<string, boolean>;
}

interface MapConfig {
	stressCards: number;
	heatCards: number;
	track: Track;
}

const MAP_CONFIG: Record<Map, MapConfig> = {
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

function createStartingDeck(map: Map): Card[] {
	const config = MAP_CONFIG[map];
	return [
		...STARTING_SPEED_CARDS,
		...STARTING_UPGRADE_CARDS,
		...createStressCards(config.stressCards),
	];
}

function createStartingEngine(map: Map): Card[] {
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
	for (const id of request.playerIds) {
		players[id] = new Player({
			id,
			gear: 1,
			position: 0,
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

export class Game {
	private _state: GameState;

	constructor(request: CreateGameRequest, options: GameOptions = {}) {
		const players = parseCreateGameRequest(request, options);
		for (const player of Object.values(players)) {
			player.draw();
		}
		this._state = {
			map: request.map,
			players,
			turn: 1,
			phase: "shift",
			pendingPlayers: Object.fromEntries(
				Object.keys(players).map((id) => [id, true]),
			),
		};
	}

	get state(): GameState {
		return structuredClone(this._state);
	}

	dispatch(playerId: string, action: Action): void {
		if (action.type !== this._state.phase) {
			throw new Error(`Invalid action for phase ${this._state.phase}`);
		}

		const player = this._state.players[playerId];
		if (!player) {
			throw new Error("Player not found");
		}

		if (!this._state.pendingPlayers[playerId]) {
			throw new Error("Player has already acted this phase");
		}

		switch (action.type) {
			case "shift": {
				player.shift(action.gear);
				break;
			}
			case "playCards": {
				player.playCards(action.cardIndices);
				break;
			}
			case "discardAndReplenish": {
				player.discardAndReplenish(action.discardIndices);
				break;
			}
		}

		this._state.pendingPlayers[playerId] = false;

		const allActed = Object.values(this._state.pendingPlayers).every((v) => !v);
		if (allActed) {
			this.advancePhase();
		}
	}

	private advancePhase(): void {
		const phaseOrder: Phase[] = [
			"shift",
			"playCards",
			"move",
			"discardAndReplenish",
		];
		const currentPhase = phaseOrder.indexOf(this._state.phase);
		const nextPhase = currentPhase + 1;
		const isEndOfTurn = nextPhase >= phaseOrder.length;

		if (isEndOfTurn) {
			this._state.phase = phaseOrder[0];
			this._state.turn += 1;
		} else {
			this._state.phase = phaseOrder[nextPhase];
		}

		if (this._state.phase === "move") {
			const track = MAP_CONFIG[this._state.map].track;
			for (const player of Object.values(this._state.players)) {
				player.move(track);
			}
			this._state.phase = "discardAndReplenish";
		}

		this._state.pendingPlayers = Object.fromEntries(
			Object.keys(this._state.players).map((id) => [id, true]),
		);
	}
}
