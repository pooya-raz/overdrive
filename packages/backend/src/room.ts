import { DurableObject } from "cloudflare:workers";
import { type Action, Game } from "./engine/game";
import type { Lobby } from "./lobby";
import type {
	RoomClientMessage,
	RoomInfo,
	RoomPlayer,
	RoomState,
} from "./types/lobby";

interface Env {
	LOBBY: DurableObjectNamespace<Lobby>;
}

export class Room extends DurableObject<Env> {
	private connections = new Map<WebSocket, string>(); // ws -> playerId
	private players = new Map<string, RoomPlayer>(); // playerId -> player info
	private status: "waiting" | "playing" = "waiting";
	private hostId: string | null = null;
	private game: Game | null = null;
	private roomId = "";
	private roomName = "";

	async fetch(request: Request): Promise<Response> {
		// Extract room info from URL params (only on first connection)
		const url = new URL(request.url);
		const roomIdParam = url.searchParams.get("roomId");
		const roomNameParam = url.searchParams.get("roomName");

		if (roomIdParam && !this.roomId) {
			this.roomId = roomIdParam;
		}
		if (!this.roomName) {
			this.roomName = roomNameParam || "Game Room";
		}

		const [client, server] = Object.values(new WebSocketPair());

		server.accept();
		const playerId = crypto.randomUUID();
		this.connections.set(server, playerId);

		server.addEventListener("message", (event) => {
			this.handleMessage(server, event.data as string);
		});

		server.addEventListener("close", () => {
			this.handleDisconnect(server);
		});

		return new Response(null, { status: 101, webSocket: client });
	}

	private handleMessage(ws: WebSocket, data: string): void {
		try {
			const message: RoomClientMessage = JSON.parse(data);
			const playerId = this.connections.get(ws);
			if (!playerId) return;

			switch (message.type) {
				case "join":
					this.handleJoin(ws, playerId, message.nickname);
					break;
				case "leave":
					this.handleLeave(ws, playerId);
					break;
				case "startGame":
					this.handleStartGame(ws, playerId);
					break;
				case "action":
					this.handleAction(ws, playerId, message.action);
					break;
			}
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";
			ws.send(JSON.stringify({ type: "error", message: errorMessage }));
		}
	}

	private handleJoin(ws: WebSocket, playerId: string, nickname: string): void {
		// If game is in progress, try to rejoin by nickname
		if (this.status === "playing") {
			const existingPlayer = Array.from(this.players.values()).find(
				(p) => p.nickname === nickname,
			);
			if (existingPlayer) {
				// Rejoin: map this connection to the existing player ID
				this.connections.set(ws, existingPlayer.id);
				// Send room state first so frontend knows player info
				const roomState: RoomState = {
					id: this.roomId,
					name: this.roomName,
					status: this.status,
					hostId: this.hostId || "",
					players: Array.from(this.players.values()),
				};
				ws.send(JSON.stringify({ type: "roomState", state: roomState }));
				// Then send game started and current game state
				ws.send(JSON.stringify({ type: "gameStarted" }));
				if (this.game) {
					const state = this.game.getStateForPlayer(existingPlayer.id);
					ws.send(JSON.stringify({ type: "state", state }));
				}
				return;
			}
			ws.send(
				JSON.stringify({ type: "error", message: "Game already started" }),
			);
			return;
		}

		if (this.players.size >= 6) {
			ws.send(JSON.stringify({ type: "error", message: "Room is full" }));
			return;
		}

		const isHost = this.players.size === 0;
		if (isHost) {
			this.hostId = playerId;
		}

		this.players.set(playerId, { id: playerId, nickname, isHost });
		this.broadcastRoomState();
		this.notifyLobby();
	}

	private handleLeave(ws: WebSocket, playerId: string): void {
		this.removePlayer(playerId);
		ws.close();
	}

	private handleDisconnect(ws: WebSocket): void {
		const playerId = this.connections.get(ws);
		this.connections.delete(ws);

		// Only remove player from game if we're still in waiting room
		// During a game, players can rejoin by nickname
		if (playerId && this.status === "waiting") {
			this.removePlayer(playerId);
		}
	}

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

		this.broadcastRoomState();
		this.notifyLobby();
	}

	private handleStartGame(ws: WebSocket, playerId: string): void {
		if (playerId !== this.hostId) {
			ws.send(
				JSON.stringify({
					type: "error",
					message: "Only host can start the game",
				}),
			);
			return;
		}

		if (this.players.size < 2) {
			ws.send(
				JSON.stringify({
					type: "error",
					message: "Need at least 2 players to start",
				}),
			);
			return;
		}

		this.status = "playing";
		const playerIds = Array.from(this.players.keys());
		this.game = new Game({ playerIds, map: "USA" });

		// Broadcast game started, then send initial state
		this.broadcast({ type: "gameStarted" });
		this.broadcastGameState();
		this.notifyLobby();
	}

	private handleAction(ws: WebSocket, playerId: string, action: Action): void {
		if (!this.game) {
			ws.send(JSON.stringify({ type: "error", message: "Game not started" }));
			return;
		}

		if (!this.players.has(playerId)) {
			ws.send(JSON.stringify({ type: "error", message: "Not in this room" }));
			return;
		}

		this.game.dispatch(playerId, action);
		this.broadcastGameState();
	}

	private broadcastRoomState(): void {
		const state: RoomState = {
			id: this.roomId,
			name: this.roomName,
			status: this.status,
			hostId: this.hostId || "",
			players: Array.from(this.players.values()),
		};
		this.broadcast({ type: "roomState", state });
	}

	private broadcastGameState(): void {
		if (!this.game) return;
		for (const [ws, playerId] of this.connections) {
			if (!this.players.has(playerId)) continue;
			const state = this.game.getStateForPlayer(playerId);
			ws.send(JSON.stringify({ type: "state", state }));
		}
	}

	private broadcast(message: object): void {
		const data = JSON.stringify(message);
		for (const ws of this.connections.keys()) {
			ws.send(data);
		}
	}

	private notifyLobby(): void {
		const hostPlayer = this.hostId ? this.players.get(this.hostId) : null;
		const roomInfo: RoomInfo = {
			id: this.roomId,
			name: this.roomName,
			hostNickname: hostPlayer?.nickname || "Unknown",
			playerCount: this.players.size,
			maxPlayers: 6,
			status: this.status,
		};

		const lobbyId = this.env.LOBBY.idFromName("main");
		const lobby = this.env.LOBBY.get(lobbyId);
		lobby.updateRoom(roomInfo);
	}
}
