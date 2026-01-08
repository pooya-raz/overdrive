import { DurableObject } from "cloudflare:workers";
import { GameRoom, type RoomResult } from "./game-room";
import type { Lobby } from "./lobby";
import type { RoomClientMessage, RoomInfo } from "./types/lobby";

interface Env {
	LOBBY: DurableObjectNamespace<Lobby>;
}

export class GameRoomDO extends DurableObject<Env> {
	private room: GameRoom;
	private wsMap = new Map<WebSocket, string>(); // ws -> visitorId
	private visitorWsMap = new Map<string, WebSocket>(); // visitorId -> ws

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
		this.room = new GameRoom("", "Game Room");
	}

	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);
		const roomIdParam = url.searchParams.get("roomId");
		const roomNameParam = url.searchParams.get("roomName");

		if (roomIdParam) {
			this.room.setRoomId(roomIdParam);
		}
		if (roomNameParam) {
			this.room.setRoomName(roomNameParam);
		}

		const [client, server] = Object.values(new WebSocketPair());

		server.accept();
		const visitorId = crypto.randomUUID();
		this.wsMap.set(server, visitorId);
		this.visitorWsMap.set(visitorId, server);
		this.room.addConnection(visitorId);

		server.addEventListener("message", (event) => {
			this.handleMessage(server, event.data as string);
		});

		server.addEventListener("close", () => {
			this.handleDisconnect(server);
		});

		return new Response(null, { status: 101, webSocket: client });
	}

	private handleMessage(ws: WebSocket, data: string): void {
		const visitorId = this.wsMap.get(ws);
		if (!visitorId) return;

		try {
			const message: RoomClientMessage = JSON.parse(data);
			let result: RoomResult;

			switch (message.type) {
				case "join":
					result = this.room.handleJoin(visitorId, message.nickname);
					break;
				case "leave":
					result = this.room.handleLeave(visitorId);
					break;
				case "startGame":
					result = this.room.handleStartGame(visitorId);
					break;
				case "action":
					result = this.room.handleAction(visitorId, message.action);
					break;
				case "quitGame":
					result = this.room.handleQuitGame();
					break;
				default:
					return;
			}

			this.executeResult(result);
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";
			ws.send(JSON.stringify({ type: "error", message: errorMessage }));
		}
	}

	private handleDisconnect(ws: WebSocket): void {
		const visitorId = this.wsMap.get(ws);
		if (visitorId) {
			const result = this.room.handleDisconnect(visitorId);
			this.wsMap.delete(ws);
			this.visitorWsMap.delete(visitorId);
			this.executeResult(result);
		}
	}

	private executeResult(result: RoomResult): void {
		if (result.broadcast) {
			this.broadcast(result.broadcast);
		}
		if (result.broadcastGameState) {
			this.broadcastGameState();
		}
		if (result.toVisitor) {
			for (const message of result.toVisitor.messages) {
				this.sendToVisitor(result.toVisitor.visitorId, message);
			}
		}
		if (result.toLobby) {
			this.notifyLobby(result.toLobby);
		}
		if (result.closeConnection) {
			this.closeVisitor(result.closeConnection);
		}
	}

	private sendToVisitor(visitorId: string, message: object): void {
		const ws = this.visitorWsMap.get(visitorId);
		if (ws) {
			ws.send(JSON.stringify(message));
		}
	}

	private closeVisitor(visitorId: string): void {
		const ws = this.visitorWsMap.get(visitorId);
		if (ws) {
			ws.close();
		}
	}

	private broadcastGameState(): void {
		for (const [ws, visitorId] of this.wsMap) {
			const playerId = this.room.getPlayerId(visitorId);
			if (!playerId || !this.room.hasPlayer(playerId)) continue;
			const state = this.room.getGameStateForPlayer(playerId);
			if (state) {
				ws.send(JSON.stringify({ type: "state", state }));
			}
		}
	}

	private broadcast(message: object): void {
		const data = JSON.stringify(message);
		for (const ws of this.wsMap.keys()) {
			ws.send(data);
		}
	}

	private notifyLobby(roomInfo: RoomInfo): void {
		const lobbyId = this.env.LOBBY.idFromName("main");
		const lobby = this.env.LOBBY.get(lobbyId);
		lobby.updateRoom(roomInfo);
	}
}
