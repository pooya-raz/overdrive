import { useCallback, useEffect, useRef, useState } from "react";
import type { RoomInfo } from "@heat/shared";

type ConnectionStatus = "connecting" | "connected" | "disconnected";

interface UseLobbySocketReturn {
	status: ConnectionStatus;
	rooms: RoomInfo[];
	error: string | null;
	createdRoomId: string | null;
	createRoom: (roomName: string, hostUsername: string) => void;
	clearCreatedRoom: () => void;
}

export function useLobbySocket(url: string): UseLobbySocketReturn {
	const [status, setStatus] = useState<ConnectionStatus>("disconnected");
	const [rooms, setRooms] = useState<RoomInfo[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [createdRoomId, setCreatedRoomId] = useState<string | null>(null);
	const socketRef = useRef<WebSocket | null>(null);

	useEffect(() => {
		if (!url) {
			return;
		}

		const socket = new WebSocket(url);
		socketRef.current = socket;
		setStatus("connecting");
		setError(null);

		socket.onopen = () => {
			setStatus("connected");
			socket.send(JSON.stringify({ type: "subscribe" }));
		};

		socket.onmessage = (event) => {
			const message = JSON.parse(event.data);

			if (message.type === "roomList") {
				setError(null);
				setRooms(message.rooms);
			} else if (message.type === "roomCreated") {
				setError(null);
				setCreatedRoomId(message.roomId);
			} else if (message.type === "error") {
				setError(message.message);
			}
		};

		socket.onclose = () => {
			setStatus("disconnected");
		};

		socket.onerror = () => {
			setError("WebSocket connection error");
		};

		return () => {
			socket.close();
		};
	}, [url]);

	const createRoom = useCallback((roomName: string, hostUsername: string) => {
		if (socketRef.current?.readyState === WebSocket.OPEN) {
			socketRef.current.send(
				JSON.stringify({ type: "createRoom", roomName, hostUsername }),
			);
		}
	}, []);

	const clearCreatedRoom = useCallback(() => {
		setCreatedRoomId(null);
	}, []);

	return { status, rooms, error, createdRoomId, createRoom, clearCreatedRoom };
}
