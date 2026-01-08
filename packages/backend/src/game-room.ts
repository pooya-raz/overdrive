import { type Action, Game } from "./engine/game";
import type { RoomInfo, RoomPlayer, RoomState } from "./types/lobby";

/**
 * Describes the side effects that should be executed after a room operation.
 * The Room wrapper executes these effects (WebSocket sends, lobby notifications).
 */
export interface RoomResult {
	/** Message to broadcast to all connected visitors */
	broadcast?: object;
	/** If true, send each player their personalized game state */
	broadcastGameState?: boolean;
	/** Messages to send to a specific visitor */
	toVisitor?: { visitorId: string; messages: object[] };
	/** Room info to send to the lobby for the room list */
	toLobby?: RoomInfo;
	/** Visitor ID whose connection should be closed */
	closeConnection?: string;
}

const EMPTY_RESULT: RoomResult = {};

export class GameRoom {
	private connections = new Map<string, string>(); // visitorId -> playerId
	private players = new Map<string, RoomPlayer>(); // playerId -> player info
	private status: "waiting" | "playing" = "waiting";
	private hostId: string | null = null;
	private game: Game | null = null;
	private roomId: string;
	private roomName: string;

	constructor(roomId: string, roomName: string) {
		this.roomId = roomId;
		this.roomName = roomName;
	}

	get state(): RoomState {
		return {
			id: this.roomId,
			name: this.roomName,
			status: this.status,
			hostId: this.hostId || "",
			players: Array.from(this.players.values()),
		};
	}

	getRoomInfo(): RoomInfo {
		const hostPlayer = this.hostId ? this.players.get(this.hostId) : null;
		return {
			id: this.roomId,
			name: this.roomName,
			hostNickname: hostPlayer?.nickname || "Unknown",
			playerCount: this.players.size,
			maxPlayers: 6,
			status: this.status,
		};
	}

	setRoomId(roomId: string): void {
		if (!this.roomId) {
			this.roomId = roomId;
		}
	}

	setRoomName(roomName: string): void {
		if (!this.roomName) {
			this.roomName = roomName;
		}
	}

	addConnection(visitorId: string): void {
		this.connections.set(visitorId, visitorId);
	}

	removeConnection(visitorId: string): void {
		this.connections.delete(visitorId);
	}

	getPlayerId(visitorId: string): string | undefined {
		return this.connections.get(visitorId);
	}

	/**
	 * Handles a player joining the room.
	 * - During waiting: adds player to room, first player becomes host
	 * - During game: allows rejoin by matching nickname to existing player
	 */
	handleJoin(visitorId: string, nickname: string): RoomResult {
		const playerId = this.connections.get(visitorId);
		if (!playerId) return EMPTY_RESULT;

		if (this.status === "playing") {
			const existingPlayer = Array.from(this.players.values()).find(
				(p) => p.nickname === nickname,
			);
			if (existingPlayer) {
				this.connections.set(visitorId, existingPlayer.id);
				const messages: object[] = [
					{ type: "roomState", state: this.state },
					{ type: "gameStarted" },
				];
				if (this.game) {
					messages.push({
						type: "state",
						state: this.game.getStateForPlayer(existingPlayer.id),
					});
				}
				return { toVisitor: { visitorId, messages } };
			}
			return {
				toVisitor: {
					visitorId,
					messages: [{ type: "error", message: "Game already started" }],
				},
			};
		}

		if (this.players.size >= 6) {
			return {
				toVisitor: {
					visitorId,
					messages: [{ type: "error", message: "Room is full" }],
				},
			};
		}

		const isHost = this.players.size === 0;
		if (isHost) {
			this.hostId = playerId;
		}

		this.players.set(playerId, { id: playerId, nickname, isHost });
		return {
			broadcast: { type: "roomState", state: this.state },
			toLobby: this.getRoomInfo(),
		};
	}

	/** Handles explicit leave request. Removes player and closes connection. */
	handleLeave(visitorId: string): RoomResult {
		const playerId = this.connections.get(visitorId);
		if (playerId) {
			this.removePlayerInternal(playerId);
		}
		return {
			broadcast: { type: "roomState", state: this.state },
			toLobby: this.getRoomInfo(),
			closeConnection: visitorId,
		};
	}

	/**
	 * Handles WebSocket disconnect.
	 * - During waiting: removes player (they can rejoin as new player)
	 * - During game: keeps player (they can rejoin by nickname)
	 */
	handleDisconnect(visitorId: string): RoomResult {
		const playerId = this.connections.get(visitorId);
		this.connections.delete(visitorId);

		if (playerId && this.status === "waiting") {
			this.removePlayerInternal(playerId);
			return {
				broadcast: { type: "roomState", state: this.state },
				toLobby: this.getRoomInfo(),
			};
		}
		return EMPTY_RESULT;
	}

	private removePlayerInternal(playerId: string): void {
		const player = this.players.get(playerId);
		if (!player) return;

		this.players.delete(playerId);

		if (player.isHost && this.players.size > 0) {
			const newHost = this.players.values().next().value;
			if (newHost) {
				newHost.isHost = true;
				this.hostId = newHost.id;
			}
		}

		if (this.players.size === 0) {
			this.hostId = null;
		}
	}

	/** Starts the game. Only host can start, requires 2+ players. */
	handleStartGame(visitorId: string): RoomResult {
		const playerId = this.connections.get(visitorId);

		if (playerId !== this.hostId) {
			return {
				toVisitor: {
					visitorId,
					messages: [
						{ type: "error", message: "Only host can start the game" },
					],
				},
			};
		}

		if (this.players.size < 2) {
			return {
				toVisitor: {
					visitorId,
					messages: [
						{ type: "error", message: "Need at least 2 players to start" },
					],
				},
			};
		}

		this.status = "playing";
		const playerIds = Array.from(this.players.keys());
		this.game = new Game({ playerIds, map: "USA" });

		return {
			broadcast: { type: "gameStarted" },
			broadcastGameState: true,
			toLobby: this.getRoomInfo(),
		};
	}

	/** Dispatches a game action. Validates player identity and game state. */
	handleAction(visitorId: string, action: Action): RoomResult {
		const playerId = this.connections.get(visitorId);

		if (!this.game) {
			return {
				toVisitor: {
					visitorId,
					messages: [{ type: "error", message: "Game not started" }],
				},
			};
		}

		if (!playerId || !this.players.has(playerId)) {
			return {
				toVisitor: {
					visitorId,
					messages: [{ type: "error", message: "Not in this room" }],
				},
			};
		}

		this.game.dispatch(playerId, action);
		return { broadcastGameState: true };
	}

	/** Ends the current game and returns room to waiting state. */
	handleQuitGame(): RoomResult {
		this.game = null;
		this.status = "waiting";
		return {
			broadcast: { type: "roomState", state: this.state },
			toLobby: this.getRoomInfo(),
		};
	}

	// For game state broadcasting
	getGameStateForPlayer(playerId: string): object | null {
		if (!this.game) return null;
		return this.game.getStateForPlayer(playerId);
	}

	hasPlayer(playerId: string): boolean {
		return this.players.has(playerId);
	}

	get playerCount(): number {
		return this.players.size;
	}

	get currentStatus(): "waiting" | "playing" {
		return this.status;
	}

	get hasGame(): boolean {
		return this.game !== null;
	}
}
