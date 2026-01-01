export interface CreateGameRequest {
	playerIds: string[];
}

export type Gear = 1 | 2 | 3 | 4;

export type Phase = "shift" | "playCards" | "move" | "resolve";

export type Action = { type: "shift"; gear: Gear };

export interface Player {
	id: string;
	gear: Gear;
}

export interface GameState {
	players: Record<string, Player>;
	turn: number;
	phase: Phase;
	pendingPlayers: Record<string, boolean>;
}

function parseCreateGameRequest(
	request: CreateGameRequest,
): Record<string, Player> {
	if (new Set(request.playerIds).size !== request.playerIds.length) {
		throw new Error("Player IDs must be unique");
	}
	const players: Record<string, Player> = {};
	for (const id of request.playerIds) {
		players[id] = { id, gear: 1 };
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
