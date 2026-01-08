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

	// ─────────────────────────────────────────────────────────────────────────
	// State accessors
	// ─────────────────────────────────────────────────────────────────────────

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

	get playerCount(): number {
		return this.players.size;
	}

	get currentStatus(): "waiting" | "playing" {
		return this.status;
	}

	get hasGame(): boolean {
		return this.game !== null;
	}

	getPlayerId(visitorId: string): string | undefined {
		return this.connections.get(visitorId);
	}

	hasPlayer(playerId: string): boolean {
		return this.players.has(playerId);
	}

	getGameStateForPlayer(playerId: string): object | null {
		return this.game?.getStateForPlayer(playerId) ?? null;
	}

	// ─────────────────────────────────────────────────────────────────────────
	// Connection management (called by DO wrapper)
	// ─────────────────────────────────────────────────────────────────────────

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

	// ─────────────────────────────────────────────────────────────────────────
	// Message handlers
	// ─────────────────────────────────────────────────────────────────────────

	/**
	 * Handles a player joining the room.
	 * - During waiting: adds player to room, first player becomes host
	 * - During game: allows rejoin by matching nickname to existing player
	 */
	handleJoin(visitorId: string, nickname: string): RoomResult {
		const playerId = this.connections.get(visitorId);
		if (!playerId) return {};

		// During an active game, only allow rejoining as an existing player
		if (this.status === "playing") {
			return this.handleRejoinDuringGame(visitorId, nickname);
		}

		if (this.players.size >= 6) {
			return this.errorToVisitor(visitorId, "Room is full");
		}

		const isFirstPlayer = this.players.size === 0;
		if (isFirstPlayer) {
			this.hostId = playerId;
		}

		this.players.set(playerId, {
			id: playerId,
			nickname,
			isHost: isFirstPlayer,
		});

		return {
			broadcast: { type: "roomState", state: this.state },
			toLobby: this.getRoomInfo(),
		};
	}

	private handleRejoinDuringGame(
		visitorId: string,
		nickname: string,
	): RoomResult {
		const existingPlayer = Array.from(this.players.values()).find(
			(player) => player.nickname === nickname,
		);

		if (!existingPlayer) {
			return this.errorToVisitor(visitorId, "Game already started");
		}

		// Reconnect this visitor to their existing player
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

	/** Handles explicit leave request. Removes player and closes connection. */
	handleLeave(visitorId: string): RoomResult {
		const playerId = this.connections.get(visitorId);
		if (playerId) {
			this.removePlayer(playerId);
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
			this.removePlayer(playerId);
			return {
				broadcast: { type: "roomState", state: this.state },
				toLobby: this.getRoomInfo(),
			};
		}

		return {};
	}

	/** Starts the game. Only host can start, requires 2+ players. */
	handleStartGame(visitorId: string): RoomResult {
		const playerId = this.connections.get(visitorId);

		if (playerId !== this.hostId) {
			return this.errorToVisitor(visitorId, "Only host can start the game");
		}

		if (this.players.size < 2) {
			return this.errorToVisitor(visitorId, "Need at least 2 players to start");
		}

		this.status = "playing";
		this.game = new Game({
			playerIds: Array.from(this.players.keys()),
			map: "USA",
		});

		return {
			broadcast: { type: "gameStarted" },
			broadcastGameState: true,
			toLobby: this.getRoomInfo(),
		};
	}

	/** Dispatches a game action. Validates player identity and game state. */
	handleAction(visitorId: string, action: Action): RoomResult {
		if (!this.game) {
			return this.errorToVisitor(visitorId, "Game not started");
		}

		const playerId = this.connections.get(visitorId);
		if (!playerId || !this.players.has(playerId)) {
			return this.errorToVisitor(visitorId, "Not in this room");
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

	// ─────────────────────────────────────────────────────────────────────────
	// Private helpers
	// ─────────────────────────────────────────────────────────────────────────

	private removePlayer(playerId: string): void {
		const player = this.players.get(playerId);
		if (!player) return;

		this.players.delete(playerId);

		// Reassign host if needed
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

	private errorToVisitor(visitorId: string, message: string): RoomResult {
		return {
			toVisitor: {
				visitorId,
				messages: [{ type: "error", message }],
			},
		};
	}
}
