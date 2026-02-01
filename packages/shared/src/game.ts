export type GameMap = "USA" | "Test";

export type Gear = 1 | 2 | 3 | 4;

export type CardType = "speed" | "heat" | "stress" | "upgrade";

export interface StressResolution {
	drawnCards: Card[];
}

export interface Card {
	type: CardType;
	value?: number;
	resolution?: StressResolution;
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
	| "move"
	| "adrenaline"
	| "react"
	| "slipstream"
	| "discard";

export type ReactChoice = "cooldown" | "boost" | "skip";

export interface TurnActions {
	adrenaline?: { acceptMove: boolean };
	react?: { action: ReactChoice; amount?: number };
	slipstream?: { used: boolean };
	discard?: { count: number };
}

export type Action =
	| { type: "plan"; gear: Gear; cardIndices: number[] }
	| { type: "move" }
	| { type: "adrenaline"; acceptMove: boolean }
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
	played: Card[];
	turnActions: TurnActions;
	speed: number;
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
	playerOrder: string[];
}
