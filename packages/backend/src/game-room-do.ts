import { DurableObject } from "cloudflare:workers";
import { GameRoom, type RoomResult } from "./game-room";
import type { Lobby } from "./lobby";
import type { RoomClientMessage } from "./types/lobby";

interface Env {
	LOBBY: DurableObjectNamespace<Lobby>;
}

export class GameRoomDO extends DurableObject<Env> {
	private room: GameRoom | null = null;
	private visitorIdBySocket = new Map<WebSocket, string>();
	private socketByVisitorId = new Map<string, WebSocket>();

	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);
		const roomId = url.searchParams.get("roomId") ?? crypto.randomUUID();
		const roomName = url.searchParams.get("roomName") ?? "Game Room";

		// Lazy init - first connection creates the room
		if (!this.room) {
			this.room = new GameRoom(roomId, roomName);
		}

		const [client, server] = Object.values(new WebSocketPair());

		server.accept();
		const visitorId = crypto.randomUUID();
		this.visitorIdBySocket.set(server, visitorId);
		this.socketByVisitorId.set(visitorId, server);
		this.room.connect(visitorId);

		server.addEventListener("message", (event) => {
			this.handleMessage(server, event.data as string);
		});

		server.addEventListener("close", () => {
			this.handleClose(server);
		});

		return new Response(null, { status: 101, webSocket: client });
	}

	private handleMessage(ws: WebSocket, data: string): void {
		const visitorId = this.visitorIdBySocket.get(ws);
		if (!visitorId || !this.room) return;

		try {
			const message: RoomClientMessage = JSON.parse(data);
			const result = this.room.handleMessage(visitorId, message);
			this.executeResult(result);
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";
			ws.send(JSON.stringify({ type: "error", message: errorMessage }));
		}
	}

	private handleClose(ws: WebSocket): void {
		const visitorId = this.visitorIdBySocket.get(ws);
		if (visitorId && this.room) {
			const result = this.room.handleDisconnect(visitorId);
			this.visitorIdBySocket.delete(ws);
			this.socketByVisitorId.delete(visitorId);
			this.executeResult(result);
		}
	}

	/**
	 * Execute all side effects described in a RoomResult.
	 * This is the single point where WebSocket sends and lobby notifications happen.
	 */
	private executeResult(result: RoomResult): void {
		// Broadcast to all connected visitors
		if (result.broadcast) {
			const data = JSON.stringify(result.broadcast);
			for (const ws of this.visitorIdBySocket.keys()) {
				ws.send(data);
			}
		}

		// Send per-visitor game states
		if (result.gameStates) {
			for (const [visitorId, state] of result.gameStates) {
				this.socketByVisitorId
					.get(visitorId)
					?.send(JSON.stringify({ type: "state", state }));
			}
		}

		// Send messages to a specific visitor
		if (result.toVisitor) {
			const ws = this.socketByVisitorId.get(result.toVisitor.visitorId);
			if (ws) {
				for (const message of result.toVisitor.messages) {
					ws.send(JSON.stringify(message));
				}
			}
		}

		// Notify lobby of room state changes
		if (result.toLobby) {
			const lobbyId = this.env.LOBBY.idFromName("main");
			const lobby = this.env.LOBBY.get(lobbyId);
			lobby.updateRoom(result.toLobby);
		}

		// Close a visitor's connection
		if (result.closeConnection) {
			this.socketByVisitorId.get(result.closeConnection)?.close();
		}
	}
}
