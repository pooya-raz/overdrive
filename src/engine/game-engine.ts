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
	players: Player[];
	turn: number;
	phase: Phase;
	pendingPlayers: string[];
}

function parseCreateGameRequest(request: CreateGameRequest): Player[] {
	if (new Set(request.playerIds).size !== request.playerIds.length) {
		throw new Error("Player IDs must be unique");
	}
	return request.playerIds.map((id): Player => ({ id, gear: 1 }));
}

export class Game {
	private _state: GameState;

	constructor(request: CreateGameRequest) {
		const players = parseCreateGameRequest(request);
		this._state = {
			players,
			turn: 1,
			phase: "shift",
			pendingPlayers: players.map((p) => p.id),
		};
	}

	get state(): GameState {
		return this._state;
	}

	dispatch(playerId: string, action: Action): void {
		if (action.type !== this._state.phase) {
			throw new Error(`Invalid action for phase ${this._state.phase}`);
		}

		const playerIndex = this._state.players.findIndex((p) => p.id === playerId);
		if (playerIndex === -1) {
			throw new Error("Player not found");
		}

		if (!this._state.pendingPlayers.includes(playerId)) {
			throw new Error("Player has already acted this phase");
		}

		switch (action.type) {
			case "shift":
				this._state.players[playerIndex].gear = action.gear;
				break;
		}

		this._state.pendingPlayers = this._state.pendingPlayers.filter(
			(id) => id !== playerId,
		);

		if (this._state.pendingPlayers.length === 0) {
			this.advancePhase();
		}
	}

	private advancePhase(): void {
		const phaseOrder: Phase[] = ["shift", "playCards", "move", "resolve"];
		const currentIndex = phaseOrder.indexOf(this._state.phase);
		const nextIndex = currentIndex + 1;
		const isEndOfTurn = nextIndex >= phaseOrder.length;

		if (isEndOfTurn) {
			this._state.phase = phaseOrder[0];
			this._state.turn += 1;
		} else {
			this._state.phase = phaseOrder[nextIndex];
		}

		this._state.pendingPlayers = this._state.players.map((p) => p.id);
	}
}
