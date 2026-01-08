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

export type GamePhase = "planning" | "resolution" | "finished";

export type TurnState =
	| "plan"
	| "adrenaline"
	| "react"
	| "slipstream"
	| "discard";

export type ReactChoice = "cooldown" | "boost" | "skip";

export type Action =
	| { type: "plan"; gear: Gear; cardIndices: number[] }
	| { type: "adrenaline"; acceptMove: boolean; acceptCooldown: boolean }
	| { type: "react"; action: ReactChoice; amount?: number }
	| { type: "slipstream"; use: boolean }
	| { type: "discard"; cardIndices: number[] };

export interface PlayerData {
	id: string;
	username: string;
	gear: Gear;
	position: number;
	onRaceline: boolean;
	hand: Card[];
	deckSize: number;
	playedCount: number;
	engineSize: number;
	discardSize: number;
	discardTop: Card | null;
	hasAdrenaline: boolean;
	availableCooldowns: number;
	lap: number;
	finished: boolean;
}

export interface GameState {
	map: GameMap;
	track: Track;
	players: Record<string, PlayerData>;
	turn: number;
	phase: GamePhase;
	currentState: TurnState;
	pendingPlayers: Record<string, boolean>;
	turnOrder: string[];
	currentPlayerIndex: number;
	laps: number;
	finishOrder: string[];
}

// Lobby types
export interface RoomInfo {
	id: string;
	name: string;
	hostNickname: string;
	playerCount: number;
	maxPlayers: number;
	status: "waiting" | "playing";
}

export interface RoomPlayer {
	id: string;
	nickname: string;
	isHost: boolean;
}

export interface RoomState {
	id: string;
	name: string;
	status: "waiting" | "playing";
	hostId: string;
	players: RoomPlayer[];
}
