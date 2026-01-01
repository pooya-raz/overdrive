export interface CreateGameRequest {
	playerIds: string[];
}

export interface Player {
	id: string;
}

export interface GameState {
	players: Player[];
	turn: number;
}

function parseCreateGameRequest(request: CreateGameRequest): Player[] {
	if (new Set(request.playerIds).size !== request.playerIds.length) {
		throw new Error("Player IDs must be unique");
	}
	return request.playerIds.map((id) => ({ id }));
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
