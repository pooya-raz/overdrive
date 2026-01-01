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
	return Array(count).fill({ type: "stress" });
}

function createHeatCards(count: number): Card[] {
	return Array(count).fill({ type: "heat" });
}

export type Phase = "shift" | "playCards" | "move" | "resolve";

export type Action = { type: "shift"; gear: Gear };

export interface Player {
	id: string;
	gear: Gear;
	deck: Card[];
	engine: Card[];
}

export interface GameState {
	players: Record<string, Player>;
	turn: number;
	phase: Phase;
	pendingPlayers: Record<string, boolean>;
}

const MAP_CONFIG: Record<Map, { stressCards: number; heatCards: number }> = {
	USA: { stressCards: 3, heatCards: 6 },
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

function parseCreateGameRequest(
	request: CreateGameRequest,
): Record<string, Player> {
	if (new Set(request.playerIds).size !== request.playerIds.length) {
		throw new Error("Player IDs must be unique");
	}
	const players: Record<string, Player> = {};
	for (const id of request.playerIds) {
		players[id] = {
			id,
			gear: 1,
			deck: createStartingDeck(request.map),
			engine: createStartingEngine(request.map),
		};
	}
	return players;
}

export class Game {
	private _state: GameState;

	constructor(request: CreateGameRequest) {
		const players = parseCreateGameRequest(request);
		this._state = {
			players,
			turn: 1,
			phase: "shift",
			pendingPlayers: Object.fromEntries(
				Object.keys(players).map((id) => [id, true]),
			),
		};
	}

	get state(): GameState {
		return this._state;
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
				const diff = action.gear - player.gear;
				if (![-1, 0, 1].includes(diff)) {
					throw new Error("Can only shift up or down by 1 gear");
				}
				player.gear = action.gear;
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
		const phaseOrder: Phase[] = ["shift", "playCards", "move", "resolve"];
		const currentPhase = phaseOrder.indexOf(this._state.phase);
		const nextPhase = currentPhase + 1;
		const isEndOfTurn = nextPhase >= phaseOrder.length;

		if (isEndOfTurn) {
			this._state.phase = phaseOrder[0];
			this._state.turn += 1;
		} else {
			this._state.phase = phaseOrder[nextPhase];
		}

		this._state.pendingPlayers = Object.fromEntries(
			Object.keys(this._state.players).map((id) => [id, true]),
		);
	}
}
