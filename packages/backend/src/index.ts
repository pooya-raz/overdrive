import { DurableObject } from "cloudflare:workers";
import { Hono } from "hono";
import { type Action, Game } from "./engine/game";

interface Env {
	GAME_ROOM: DurableObjectNamespace<GameRoom>;
}

type ClientMessage =
	| { type: "join"; playerId: string }
	| { type: "action"; action: Action };

export class GameRoom extends DurableObject {
	// Maps WebSocket connections to player IDs. Empty string means connected but not yet joined.
	private connections = new Map<WebSocket, string>();
	private game: Game | null = null;

	async fetch(): Promise<Response> {
		const [client, server] = Object.values(new WebSocketPair());

		server.accept();
		this.connections.set(server, "");

		server.addEventListener("message", (event) => {
			this.handleMessage(server, event.data as string);
		});

		server.addEventListener("close", () => {
			this.connections.delete(server);
		});

		return new Response(null, { status: 101, webSocket: client });
	}

	private handleMessage(websocket: WebSocket, data: string): void {
		try {
			const message: ClientMessage = JSON.parse(data);

			if (message.type === "join") {
				this.handleJoin(websocket, message.playerId);
				return;
			}

			if (message.type === "action") {
				this.handleAction(websocket, message.action);
			}
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";
			websocket.send(JSON.stringify({ type: "error", message: errorMessage }));
		}
	}

	private handleJoin(websocket: WebSocket, playerId: string): void {
		this.connections.set(websocket, playerId);

		// Start the game once we have enough players
		if (!this.game) {
			const playerIds = [...new Set(this.connections.values())].filter(Boolean);
			if (playerIds.length >= 2) {
				this.game = new Game({ playerIds, map: "USA" });
			}
		}

		// Send current state to the joining player (and broadcast if game just started)
		if (this.game) {
			this.broadcastState();
		}
	}

	private handleAction(websocket: WebSocket, action: Action): void {
		const playerId = this.connections.get(websocket);
		if (!playerId) {
			websocket.send(JSON.stringify({ type: "error", message: "Not joined" }));
			return;
		}
		if (!this.game) {
			websocket.send(
				JSON.stringify({ type: "error", message: "Game not started" }),
			);
			return;
		}

		this.game.dispatch(playerId, action);
		this.broadcastState();
	}

	private broadcastState(): void {
		if (!this.game) return;
		for (const [websocket, playerId] of this.connections.entries()) {
			if (!playerId) continue;
			const state = this.game.getStateForPlayer(playerId);
			websocket.send(JSON.stringify({ type: "state", state }));
		}
	}
}

const app = new Hono<{ Bindings: Env }>();

app.get("/", (c) => {
	return c.text("Hello Hono!");
});

app.get("/ws", (c) => {
	const id = c.env.GAME_ROOM.idFromName("main");
	const room = c.env.GAME_ROOM.get(id);
	return room.fetch(c.req.raw);
});

export default app;
