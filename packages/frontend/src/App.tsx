import { useState } from "react";
import { Game } from "@/components/Game";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useGameSocket } from "@/hooks/useGameSocket";

function App() {
	const [playerId, setPlayerId] = useState("");
	const [joined, setJoined] = useState(false);

	const { status, gameState, error, sendAction } = useGameSocket({
		url: joined ? "ws://localhost:8787/ws" : "",
		playerId: joined ? playerId : "",
	});

	const handleJoin = (e: React.FormEvent) => {
		e.preventDefault();
		if (playerId.trim()) {
			setJoined(true);
		}
	};

	if (!joined) {
		return (
			<div className="min-h-screen w-full grid place-items-center p-6 bg-gradient-to-br from-slate-900 to-slate-800">
				<Card className="w-full max-w-md">
					<CardHeader className="text-center">
						<CardTitle className="text-3xl">Heat</CardTitle>
					</CardHeader>
					<CardContent>
						<form onSubmit={handleJoin} className="space-y-4">
							<input
								type="text"
								placeholder="Enter your player ID"
								value={playerId}
								onChange={(e) => setPlayerId(e.target.value)}
								autoFocus
								className="w-full px-4 py-3 rounded-md border bg-background text-center text-lg"
							/>
							<Button
								type="submit"
								disabled={!playerId.trim()}
								className="w-full"
								size="lg"
							>
								Join Game
							</Button>
						</form>
					</CardContent>
				</Card>
			</div>
		);
	}

	if (status === "connecting") {
		return (
			<div className="min-h-screen grid place-items-center bg-gradient-to-br from-slate-900 to-slate-800 text-white">
				<div className="grid gap-4 text-center">
					<h1 className="text-4xl font-bold">Heat</h1>
					<p className="text-lg">Connecting...</p>
				</div>
			</div>
		);
	}

	if (status === "disconnected") {
		return (
			<div className="min-h-screen grid place-items-center bg-gradient-to-br from-slate-900 to-slate-800 text-white">
				<div className="grid gap-4 text-center">
					<h1 className="text-4xl font-bold">Heat</h1>
					<p className="text-lg">Disconnected from server</p>
					<Button variant="outline" onClick={() => setJoined(false)}>
						Reconnect
					</Button>
				</div>
			</div>
		);
	}

	if (!gameState) {
		return (
			<div className="min-h-screen grid place-items-center bg-gradient-to-br from-slate-900 to-slate-800 text-white">
				<div className="grid gap-4 text-center">
					<h1 className="text-4xl font-bold">Heat</h1>
					<p className="text-lg">Waiting for game to start...</p>
					<p className="text-muted-foreground">
						Need at least 2 players to start
					</p>
				</div>
			</div>
		);
	}

	return (
		<Game
			gameState={gameState}
			playerId={playerId}
			onAction={sendAction}
			error={error}
		/>
	);
}

export default App;
