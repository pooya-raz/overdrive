import { useCallback, useEffect, useRef, useState } from "react";
import type { Action, GameState, RoomState } from "@heat/shared";

type ConnectionStatus = "connecting" | "connected" | "disconnected";

interface UseRoomSocketOptions {
	url: string;
	nickname: string;
}

interface UseRoomSocketReturn {
	status: ConnectionStatus;
	roomState: RoomState | null;
	gameState: GameState | null;
	gameStarted: boolean;
	error: string | null;
	playerId: string | null;
	startGame: () => void;
	leaveRoom: () => void;
	quitGame: () => void;
	sendAction: (action: Action) => void;
}

export function useRoomSocket({
	url,
	nickname,
}: UseRoomSocketOptions): UseRoomSocketReturn {
	const [status, setStatus] = useState<ConnectionStatus>("disconnected");
	const [roomState, setRoomState] = useState<RoomState | null>(null);
	const [gameState, setGameState] = useState<GameState | null>(null);
	const [gameStarted, setGameStarted] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [playerId, setPlayerId] = useState<string | null>(null);
	const socketRef = useRef<WebSocket | null>(null);

	useEffect(() => {
		if (!url || !nickname) {
			return;
		}

		const socket = new WebSocket(url);
		socketRef.current = socket;
		setStatus("connecting");
		setError(null);
		setGameStarted(false);
		setGameState(null);
		setRoomState(null);

		socket.onopen = () => {
			setStatus("connected");
			socket.send(JSON.stringify({ type: "join", nickname }));
		};

		socket.onmessage = (event) => {
			const message = JSON.parse(event.data);

			switch (message.type) {
				case "roomState": {
					setError(null);
					setRoomState(message.state);
					// Reset game state if room is back to waiting (e.g., after quit)
					if (message.state.status === "waiting") {
						setGameStarted(false);
						setGameState(null);
					}
					// Find our player ID from the room state
					const player = message.state.players.find(
						(p: { nickname: string }) => p.nickname === nickname,
					);
					if (player) {
						setPlayerId(player.id);
					}
					break;
				}
				case "gameStarted":
					setError(null);
					setGameStarted(true);
					break;
				case "state":
					setError(null);
					setGameState(message.state);
					break;
				case "error":
					setError(message.message);
					break;
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
	}, [url, nickname]);

	const startGame = useCallback(() => {
		if (socketRef.current?.readyState === WebSocket.OPEN) {
			socketRef.current.send(JSON.stringify({ type: "startGame" }));
		}
	}, []);

	const leaveRoom = useCallback(() => {
		if (socketRef.current?.readyState === WebSocket.OPEN) {
			socketRef.current.send(JSON.stringify({ type: "leave" }));
		}
		socketRef.current?.close();
	}, []);

	const quitGame = useCallback(() => {
		if (socketRef.current?.readyState === WebSocket.OPEN) {
			socketRef.current.send(JSON.stringify({ type: "quitGame" }));
		}
	}, []);

	const sendAction = useCallback((action: Action) => {
		if (socketRef.current?.readyState === WebSocket.OPEN) {
			socketRef.current.send(JSON.stringify({ type: "action", action }));
		}
	}, []);

	return {
		status,
		roomState,
		gameState,
		gameStarted,
		error,
		playerId,
		startGame,
		leaveRoom,
		quitGame,
		sendAction,
	};
}
