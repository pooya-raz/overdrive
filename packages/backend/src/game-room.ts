import { type Action, Game } from "./engine/game";
import type {
	RoomClientMessage,
	RoomInfo,
	RoomPlayer,
	RoomState,
} from "./types/lobby";

/**
 * Describes the side effects that should be executed after a room operation.
 * The GameRoomDO wrapper executes these effects (WebSocket sends, lobby notifications).
 */
export interface RoomResult {
	/** Message to broadcast to all connected visitors */
	broadcast?: object;
	/** Per-visitor game state to send (visitorId -> state) */
	gameStates?: Map<string, object>;
	/** Messages to send to a specific visitor */
	toVisitor?: { visitorId: string; messages: object[] };
	/** Room info to send to the lobby for the room list */
	toLobby?: RoomInfo;
	/** Visitor ID whose connection should be closed */
	closeConnection?: string;
}

/**
 * Pure business logic for a game room. Handles player management, game lifecycle,
 * and action dispatch. Returns RoomResult objects describing side effects.
 */
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

	/** Register a new WebSocket connection. */
	connect(visitorId: string): void {
		this.connections.set(visitorId, visitorId);
	}

	/** Handle any client message. */
	handleMessage(visitorId: string, message: RoomClientMessage): RoomResult {
		switch (message.type) {
			case "join":
				return this.handleJoin(visitorId, message.nickname);
			case "leave":
				return this.handleLeave(visitorId);
			case "startGame":
				return this.handleStartGame(visitorId);
			case "action":
				return this.handleAction(visitorId, message.action);
			case "quitGame":
				return this.handleQuitGame();
			default:
				return {};
		}
	}

	/** Handle WebSocket disconnect. */
	handleDisconnect(visitorId: string): RoomResult {
		const playerId = this.connections.get(visitorId);
		this.connections.delete(visitorId);

		if (playerId && this.status === "waiting") {
			this.removePlayer(playerId);
			return {
				broadcast: { type: "roomState", state: this.state },
				toLobby: this.roomInfo,
			};
		}

		return {};
	}

	// ─────────────────────────────────────────────────────────────────────────
	// Private message handlers
	// ─────────────────────────────────────────────────────────────────────────

	private handleJoin(visitorId: string, nickname: string): RoomResult {
		const playerId = this.connections.get(visitorId);
		if (!playerId) return {};

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
			toLobby: this.roomInfo,
		};
	}

	private handleRejoinDuringGame(
		visitorId: string,
		nickname: string,
	): RoomResult {
		const existingPlayer = Array.from(this.players.values()).find(
			(player) => player.nickname === nickname,
		);

		if (!existingPlayer || !this.game) {
			return this.errorToVisitor(visitorId, "Game already started");
		}

		this.connections.set(visitorId, existingPlayer.id);

		return {
			toVisitor: {
				visitorId,
				messages: [
					{ type: "roomState", state: this.state },
					{ type: "gameStarted" },
					{
						type: "state",
						state: this.game.getStateForPlayer(existingPlayer.id),
					},
				],
			},
		};
	}

	private handleLeave(visitorId: string): RoomResult {
		const playerId = this.connections.get(visitorId);
		if (playerId) {
			this.removePlayer(playerId);
		}

		return {
			broadcast: { type: "roomState", state: this.state },
			toLobby: this.roomInfo,
			closeConnection: visitorId,
		};
	}

	private handleStartGame(visitorId: string): RoomResult {
		const playerId = this.connections.get(visitorId);

		if (playerId !== this.hostId) {
			return this.errorToVisitor(visitorId, "Only host can start the game");
		}

		if (this.players.size < 2) {
			return this.errorToVisitor(visitorId, "Need at least 2 players to start");
		}

		this.status = "playing";
		this.game = new Game({
			players: Array.from(this.players.values()).map((p) => ({
				id: p.id,
				username: p.nickname,
			})),
			map: "USA",
		});

		return {
			broadcast: { type: "gameStarted" },
			gameStates: this.buildGameStates(),
			toLobby: this.roomInfo,
		};
	}

	private handleAction(visitorId: string, action: Action): RoomResult {
		if (!this.game) {
			return this.errorToVisitor(visitorId, "Game not started");
		}

		const playerId = this.connections.get(visitorId);
		if (!playerId || !this.players.has(playerId)) {
			return this.errorToVisitor(visitorId, "Not in this room");
		}

		try {
			this.game.dispatch(playerId, action);
			return { gameStates: this.buildGameStates() };
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown error";
			return this.errorToVisitor(visitorId, message);
		}
	}

	private handleQuitGame(): RoomResult {
		this.game = null;
		this.status = "waiting";

		return {
			broadcast: { type: "roomState", state: this.state },
			toLobby: this.roomInfo,
		};
	}

	// ─────────────────────────────────────────────────────────────────────────
	// Private helpers
	// ─────────────────────────────────────────────────────────────────────────

	private get state(): RoomState {
		return {
			id: this.roomId,
			name: this.roomName,
			status: this.status,
			hostId: this.hostId || "",
			players: Array.from(this.players.values()),
		};
	}

	private get roomInfo(): RoomInfo {
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

	private buildGameStates(): Map<string, object> {
		const states = new Map<string, object>();
		if (!this.game) return states;

		for (const [visitorId, playerId] of this.connections) {
			if (this.players.has(playerId)) {
				const state = this.game.getStateForPlayer(playerId);
				if (state) states.set(visitorId, state);
			}
		}
		return states;
	}

	private removePlayer(playerId: string): void {
		const player = this.players.get(playerId);
		if (!player) return;

		this.players.delete(playerId);

		// Reassign host if necessary
		if (player.isHost) {
			const newHost = this.players.values().next().value;
			if (newHost) {
				newHost.isHost = true;
				this.hostId = newHost.id;
			} else {
				this.hostId = null;
			}
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
