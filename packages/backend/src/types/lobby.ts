// Re-export shared lobby types
export type { RoomInfo, RoomPlayer, RoomState } from "@heat/shared";

// Backend-only lobby types

// Lobby WebSocket messages
export type LobbyClientMessage =
	| { type: "subscribe" }
	| { type: "createRoom"; roomName: string; hostNickname: string };

export type LobbyServerMessage =
	| { type: "roomList"; rooms: import("@heat/shared").RoomInfo[] }
	| { type: "roomCreated"; roomId: string }
	| { type: "error"; message: string };

// Room WebSocket messages
export type RoomClientMessage =
	| { type: "join"; nickname: string }
	| { type: "leave" }
	| { type: "startGame" }
	| { type: "action"; action: import("@heat/shared").Action }
	| { type: "quitGame" };

export type RoomServerMessage =
	| { type: "roomState"; state: import("@heat/shared").RoomState }
	| { type: "gameStarted" }
	| { type: "state"; state: import("@heat/shared").GameState }
	| { type: "error"; message: string };
