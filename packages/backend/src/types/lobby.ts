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

// Lobby WebSocket messages
export type LobbyClientMessage =
	| { type: "subscribe" }
	| { type: "createRoom"; roomName: string; hostNickname: string };

export type LobbyServerMessage =
	| { type: "roomList"; rooms: RoomInfo[] }
	| { type: "roomCreated"; roomId: string }
	| { type: "error"; message: string };

// Room WebSocket messages
export type RoomClientMessage =
	| { type: "join"; nickname: string }
	| { type: "leave" }
	| { type: "startGame" }
	| { type: "action"; action: import("../engine/game").Action }
	| { type: "quitGame" };

export type RoomServerMessage =
	| { type: "roomState"; state: RoomState }
	| { type: "gameStarted" }
	| { type: "state"; state: import("../engine/types").GameState }
	| { type: "error"; message: string };
