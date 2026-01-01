export interface CreateGameRequest {
	playerIds: string[];
}

export type Gear = 1 | 2 | 3 | 4;

export interface Player {
	id: string;
	gear: Gear;
}

export interface GameState {
	players: Player[];
	turn: number;
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
		this._state = {
			players: parseCreateGameRequest(request),
			turn: 1,
		};
	}

	get state(): GameState {
		return this._state;
	}
}
