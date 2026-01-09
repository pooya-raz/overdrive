import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConnectionStatus } from "@/components/ConnectionStatus";
import { useRoomSocket } from "@/hooks/useRoomSocket";
import { Game } from "@/components/Game";

const getWsUrl = (roomId: string, roomName: string) => {
	const base = import.meta.env.DEV
		? "ws://localhost:8787"
		: "wss://heat-backend.pooya72.workers.dev";
	return `${base}/ws/room/${roomId}?roomName=${encodeURIComponent(roomName)}`;
};

interface RoomScreenProps {
	roomId: string;
	roomName: string;
	nickname: string;
	onLeave: () => void;
}

export function RoomScreen({
	roomId,
	roomName,
	nickname,
	onLeave,
}: RoomScreenProps) {
	const {
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
	} = useRoomSocket({ url: getWsUrl(roomId, roomName), nickname });

	const handleLeave = () => {
		leaveRoom();
		onLeave();
	};

	const isHost = roomState?.hostId === playerId;

	if (status !== "connected") {
		return (
			<ConnectionStatus
				status={status}
				context="room"
				onBack={status === "disconnected" ? onLeave : undefined}
			/>
		);
	}

	// Show game if started and we have game state
	if (gameStarted && gameState && playerId) {
		return (
			<Game
				gameState={gameState}
				playerId={playerId}
				onAction={sendAction}
				onQuit={quitGame}
				error={error}
			/>
		);
	}

	// Show "Game Started!" message briefly before game state arrives
	if (gameStarted && !gameState) {
		return (
			<div className="min-h-screen grid place-items-center bg-gradient-to-br from-slate-900 to-slate-800 text-white">
				<div className="text-center">
					<h1 className="text-4xl font-bold">Game Started!</h1>
				</div>
			</div>
		);
	}

	// Waiting room
	return (
		<div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-6">
			<div className="max-w-md mx-auto space-y-6">
				{error && (
					<div className="bg-destructive text-white destructive text-sm px-3 py-1.5 rounded">
						{error}
					</div>
				)}

				<Card>
					<CardHeader>
						<CardTitle>{roomState?.name || roomName}</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<div>
							<h3 className="font-medium mb-2">
								Players ({roomState?.players.length || 0}/6)
							</h3>
							<ul className="space-y-1">
								{roomState?.players.map((player) => (
									<li key={player.id} className="flex items-center gap-2">
										<span>{player.nickname}</span>
										{player.isHost && (
											<span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded">
												Host
											</span>
										)}
										{player.nickname === nickname && (
											<span className="text-xs text-muted-foreground">
												(you)
											</span>
										)}
									</li>
								))}
							</ul>
						</div>

						<div className="flex gap-2">
							<Button variant="secondary" onClick={handleLeave} className="flex-1">
								Leave
							</Button>
							{isHost && (
								<Button
									onClick={startGame}
									className="flex-1"
									disabled={(roomState?.players.length || 0) < 2}
								>
									Start Game
								</Button>
							)}
						</div>

						{!isHost && (
							<p className="text-center text-muted-foreground text-sm">
								Waiting for host to start the game...
							</p>
						)}
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
