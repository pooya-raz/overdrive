import { DurableObject } from "cloudflare:workers";
import type { LobbyClientMessage, RoomInfo } from "./types/lobby";

export class Lobby extends DurableObject {
	private connections = new Set<WebSocket>();
	private rooms = new Map<string, RoomInfo>();

	async fetch(): Promise<Response> {
		const [client, server] = Object.values(new WebSocketPair());

		server.accept();
		this.connections.add(server);

		server.addEventListener("message", (event) => {
			this.handleMessage(server, event.data as string);
		});

		server.addEventListener("close", () => {
			this.connections.delete(server);
		});

		return new Response(null, { status: 101, webSocket: client });
	}

	private handleMessage(ws: WebSocket, data: string): void {
		try {
			const message: LobbyClientMessage = JSON.parse(data);

			if (message.type === "subscribe") {
				ws.send(
					JSON.stringify({
						type: "roomList",
						rooms: Array.from(this.rooms.values()),
					}),
				);
				return;
			}

			if (message.type === "createRoom") {
				const roomId = crypto.randomUUID();
				const roomInfo: RoomInfo = {
					id: roomId,
					name: message.roomName,
					hostNickname: message.hostNickname,
					playerCount: 0,
					maxPlayers: 6,
					status: "waiting",
				};
				this.rooms.set(roomId, roomInfo);
				ws.send(JSON.stringify({ type: "roomCreated", roomId }));
				this.broadcastRoomList();
			}
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";
			ws.send(JSON.stringify({ type: "error", message: errorMessage }));
		}
	}

	// Called by GameRoomDO to update room state
	updateRoom(roomInfo: RoomInfo): void {
		if (roomInfo.playerCount === 0 && roomInfo.status === "waiting") {
			this.rooms.delete(roomInfo.id);
		} else {
			this.rooms.set(roomInfo.id, roomInfo);
		}
		this.broadcastRoomList();
	}

	private broadcastRoomList(): void {
		const message = JSON.stringify({
			type: "roomList",
			rooms: Array.from(this.rooms.values()),
		});
		for (const ws of this.connections) {
			ws.send(message);
		}
	}
}
