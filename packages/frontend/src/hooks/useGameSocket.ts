import { useCallback, useEffect, useRef, useState } from "react";
import type { Action, GameState } from "@/types";

type ConnectionStatus = "connecting" | "connected" | "disconnected";

interface UseGameSocketOptions {
	url: string;
	playerId: string;
}

interface UseGameSocketReturn {
	status: ConnectionStatus;
	gameState: GameState | null;
	error: string | null;
	sendAction: (action: Action) => void;
}

export function useGameSocket({
	url,
	playerId,
}: UseGameSocketOptions): UseGameSocketReturn {
	const [status, setStatus] = useState<ConnectionStatus>("disconnected");
	const [gameState, setGameState] = useState<GameState | null>(null);
	const [error, setError] = useState<string | null>(null);
	const socketRef = useRef<WebSocket | null>(null);

	useEffect(() => {
		if (!url || !playerId) {
			return;
		}

		const socket = new WebSocket(url);
		socketRef.current = socket;
		setStatus("connecting");
		setError(null);

		socket.onopen = () => {
			setStatus("connected");
			socket.send(JSON.stringify({ type: "join", playerId }));
		};

		socket.onmessage = (event) => {
			const message = JSON.parse(event.data);

			if (message.type === "state") {
				setGameState(message.state);
				setError(null);
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
	}, [url, playerId]);

	const sendAction = useCallback((action: Action) => {
		if (socketRef.current?.readyState === WebSocket.OPEN) {
			socketRef.current.send(JSON.stringify({ type: "action", action }));
		}
	}, []);

	return { status, gameState, error, sendAction };
}
