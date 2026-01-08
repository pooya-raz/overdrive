import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConnectionStatus } from "@/components/ConnectionStatus";
import { useLobbySocket } from "@/hooks/useLobbySocket";

const WS_URL = import.meta.env.DEV
	? "ws://localhost:8787/ws/lobby"
	: "wss://heat-backend.pooya72.workers.dev/ws/lobby";

interface LobbyScreenProps {
	nickname: string;
	onJoinRoom: (roomId: string, roomName: string) => void;
	onChangeNickname: () => void;
}

export function LobbyScreen({
	nickname,
	onJoinRoom,
	onChangeNickname,
}: LobbyScreenProps) {
	const [newRoomName, setNewRoomName] = useState("");
	const pendingRoomNameRef = useRef<string | null>(null);
	const { status, rooms, error, createdRoomId, createRoom, clearCreatedRoom } =
		useLobbySocket(WS_URL);

	// Navigate to room when we receive the createdRoomId
	useEffect(() => {
		if (createdRoomId && pendingRoomNameRef.current) {
			onJoinRoom(createdRoomId, pendingRoomNameRef.current);
			clearCreatedRoom();
			pendingRoomNameRef.current = null;
		}
	}, [createdRoomId, onJoinRoom, clearCreatedRoom]);

	const handleCreateRoom = (e: React.FormEvent) => {
		e.preventDefault();
		if (newRoomName.trim()) {
			pendingRoomNameRef.current = newRoomName.trim();
			createRoom(newRoomName.trim(), nickname);
			setNewRoomName("");
		}
	};

	if (status !== "connected") {
		return (
			<ConnectionStatus
				status={status}
				context="lobby"
				onReconnect={status === "disconnected" ? () => window.location.reload() : undefined}
			/>
		);
	}

	return (
		<div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-6">
			<div className="max-w-2xl mx-auto space-y-6">
				<header className="flex justify-between items-center">
					<h1 className="text-3xl font-bold text-white">Heat - Lobby</h1>
					<div className="flex items-center gap-4">
						<span className="text-white">Playing as: {nickname}</span>
						<Button variant="outline" size="sm" onClick={onChangeNickname}>
							Change
						</Button>
					</div>
				</header>

				{error && (
					<div className="bg-destructive/20 text-destructive text-sm px-3 py-1.5 rounded">
						{error}
					</div>
				)}

				<Card>
					<CardHeader>
						<CardTitle>Create Room</CardTitle>
					</CardHeader>
					<CardContent>
						<form onSubmit={handleCreateRoom} className="flex gap-2">
							<input
								type="text"
								placeholder="Room name"
								value={newRoomName}
								onChange={(e) => setNewRoomName(e.target.value)}
								className="flex-1 px-3 py-2 rounded-md border bg-background"
							/>
							<Button type="submit" disabled={!newRoomName.trim()}>
								Create
							</Button>
						</form>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Available Rooms</CardTitle>
					</CardHeader>
					<CardContent>
						{rooms.length === 0 ? (
							<p className="text-muted-foreground">
								No rooms available. Create one!
							</p>
						) : (
							<ul className="space-y-2">
								{rooms.map((room) => (
									<li
										key={room.id}
										className="flex justify-between items-center p-3 bg-muted rounded"
									>
										<div>
											<span className="font-medium">{room.name}</span>
											<span className="text-muted-foreground ml-2">
												({room.playerCount}/{room.maxPlayers}) - Host:{" "}
												{room.hostNickname}
											</span>
										</div>
										<Button
											size="sm"
											onClick={() => onJoinRoom(room.id, room.name)}
										>
											{room.status === "playing" ? "Rejoin" : "Join"}
										</Button>
									</li>
								))}
							</ul>
						)}
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
