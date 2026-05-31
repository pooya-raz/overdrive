// Re-export shared types
export type {
	Action,
	Card,
	CardType,
	Corner,
	CornerPenaltyInfo,
	CornerPenaltyResult,
	GameMap,
	GamePhase,
	GameState,
	Gear,
	PlayerData,
	ReactChoice,
	SpinoutResult,
	Track,
	TurnActions,
	TurnState,
} from "@overdrive/shared";

// Backend-only types

/** True when player has no more reactions available */
export type Done = boolean;

export interface PlayerInput {
	id: string;
	username: string;
}

export interface CreateGameRequest {
	players: PlayerInput[];
	map: GameMap;
	laps?: number;
}

export interface GameOptions {
	shuffle?: ShuffleFn;
}

export type ShuffleFn = <T>(items: T[]) => T[];
