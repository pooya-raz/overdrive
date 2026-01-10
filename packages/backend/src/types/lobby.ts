// Re-export shared lobby types
export type { RoomInfo, RoomPlayer, RoomState } from "@overdrive/shared";

// Backend-only lobby types

// Lobby WebSocket messages
export type LobbyClientMessage =
	| { type: "subscribe" }
	| { type: "createRoom"; roomName: string; hostUsername: string };

export type LobbyServerMessage =
	| { type: "roomList"; rooms: import("@overdrive/shared").RoomInfo[] }
	| { type: "roomCreated"; roomId: string }
	| { type: "error"; message: string };

// Room WebSocket messages
export type RoomClientMessage =
	| { type: "join"; username: string }
	| { type: "leave" }
	| { type: "startGame" }
	| { type: "action"; action: import("@overdrive/shared").Action }
	| { type: "quitGame" };

export type RoomServerMessage =
	| { type: "roomState"; state: import("@overdrive/shared").RoomState }
	| { type: "gameStarted" }
	| { type: "state"; state: import("@overdrive/shared").GameState }
	| { type: "error"; message: string };
