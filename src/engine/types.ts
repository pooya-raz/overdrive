export type GameMap = "USA";

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

export type GamePhase = "planning" | "resolution";

export type TurnState =
	| "plan"
	| "adrenaline"
	| "react"
	| "slipstream"
	| "discard";

export type ReactChoice = "cooldown" | "boost" | "skip";

/** True when player has no more reactions available */
export type Done = boolean;

export type Action =
	| { type: "plan"; gear: Gear; cardIndices: number[] }
	| { type: "adrenaline"; acceptMove: boolean; acceptCooldown: boolean }
	| { type: "react"; action: ReactChoice; amount?: number }
	| { type: "slipstream"; use: boolean }
	| { type: "discard"; cardIndices: number[] };

export interface CreateGameRequest {
	playerIds: string[];
	map: GameMap;
}

export interface GameOptions {
	shuffle?: ShuffleFn;
}

export type ShuffleFn = <T>(items: T[]) => T[];

export interface PlayerData {
	id: string;
	gear: Gear;
	position: number;
	onRaceline: boolean;
	deck: Card[];
	hand: Card[];
	played: Card[];
	engine: Card[];
	discard: Card[];
	hasAdrenaline: boolean;
}

export interface GameState {
	map: GameMap;
	players: Record<string, PlayerData>;
	turn: number;
	phase: GamePhase;
	currentState: TurnState;
	pendingPlayers: Record<string, boolean>;
	turnOrder: string[];
	currentPlayerIndex: number;
}
