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
