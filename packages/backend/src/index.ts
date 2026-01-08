import { Hono } from "hono";
import { GameRoomDO } from "./game-room-do";
import { Lobby } from "./lobby";

// Re-export Durable Objects for Cloudflare
export { Lobby, GameRoomDO };

interface Env {
	LOBBY: DurableObjectNamespace<Lobby>;
	ROOM: DurableObjectNamespace<GameRoomDO>;
}

const app = new Hono<{ Bindings: Env }>();

app.get("/", (c) => {
	return c.text("Heat Backend");
});

// Lobby WebSocket endpoint
app.get("/ws/lobby", (c) => {
	const id = c.env.LOBBY.idFromName("main");
	const lobby = c.env.LOBBY.get(id);
	return lobby.fetch(c.req.raw);
});

// Room WebSocket endpoint
app.get("/ws/room/:roomId", (c) => {
	const roomId = c.req.param("roomId");
	const roomName = c.req.query("roomName") || "Game Room";

	const id = c.env.ROOM.idFromName(roomId);
	const room = c.env.ROOM.get(id);

	// Pass room info via URL params
	const url = new URL(c.req.url);
	url.searchParams.set("roomId", roomId);
	url.searchParams.set("roomName", roomName);

	const request = new Request(url.toString(), c.req.raw);
	return room.fetch(request);
});

export default app;
