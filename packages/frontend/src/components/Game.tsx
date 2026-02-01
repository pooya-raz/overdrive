import type { Action, GameState } from "@overdrive/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ActionPanel } from "./ActionPanel";
import { DeckInfo } from "./DeckInfo";
import { PlayerList } from "./PlayerList";
import { TrackMap } from "./TrackMap";
import { TurnSummary } from "./TurnSummary";
import { getMapConfig } from "@/data/maps";
import { playerColorsLight } from "@/data/player-colors";

interface GameProps {
	gameState: GameState;
	playerId: string;
	onAction: (action: Action) => void;
	onQuit: () => void;
	error: string | null;
}

export function isPlayersTurn(gameState: GameState, playerId: string): boolean {
	if (gameState.phase === "planning") {
		return gameState.pendingPlayers[playerId];
	}
	if (gameState.phase === "finished") {
		return false;
	}
	return gameState.turnOrder[gameState.currentPlayerIndex] === playerId;
}

export function Game({ gameState, playerId, onAction, onQuit, error }: GameProps) {
	const player = gameState.players[playerId];
	const isMyTurn = isPlayersTurn(gameState, playerId);
	const currentTurnPlayer =
		gameState.phase === "resolution"
			? gameState.turnOrder[gameState.currentPlayerIndex]
			: null;
	const currentTurnPlayerName = currentTurnPlayer
		? gameState.players[currentTurnPlayer]?.username || currentTurnPlayer
		: null;

	return (
		<div className="min-h-screen grid grid-rows-[auto_1fr] bg-gradient-to-br from-slate-900 to-slate-800">
			<header className="bg-card border-b px-6 py-4 grid grid-cols-[1fr_auto] items-center">
				<h1 className="text-2xl font-bold">Heat</h1>
				<div className="grid grid-flow-col gap-4 items-center">
					<Badge variant="outline">Turn {gameState.turn}</Badge>
					<Badge variant="secondary">{gameState.phase}</Badge>
					{currentTurnPlayerName && (
						<Badge>Current: {currentTurnPlayerName}</Badge>
					)}
					<Button variant="destructive" size="sm" onClick={onQuit}>
						Quit Game
					</Button>
				</div>
			</header>

			<div className="grid justify-items-center p-6 w-full">
				<div className="grid gap-4 w-full">
					{error && (
						<div className="bg-destructive text-white text-sm px-3 py-1.5 rounded">
							{error}
						</div>
					)}

					<TrackMap
						players={gameState.players}
						playerOrder={gameState.playerOrder}
						trackLength={gameState.track.length}
						mapConfig={getMapConfig(gameState.map)}
					/>

					<div className="grid grid-cols-[auto_1fr] gap-6 w-full max-w-5xl mx-auto">
						<aside>
							<PlayerList gameState={gameState} currentPlayerId={playerId} />
						</aside>

						<main>
							{gameState.phase === "finished" ? (
								<Card>
									<CardHeader>
										<CardTitle className="text-center">Race Finished!</CardTitle>
									</CardHeader>
									<CardContent>
										<ol className="space-y-2">
											{gameState.finishOrder.map((id, index) => (
												<li
													key={id}
													className={`p-2 rounded ${id === playerId ? "bg-blue-500/20 font-bold" : ""}`}
												>
													{index + 1}. {gameState.players[id]?.username || id} {id === playerId && "(you)"}
												</li>
											))}
										</ol>
									</CardContent>
								</Card>
							) : (
								<div className="grid gap-4">
									{isMyTurn ? (
										<ActionPanel
											currentState={gameState.currentState}
											hand={player.hand}
											currentGear={player.gear}
											availableCooldowns={player.availableCooldowns}
											onAction={onAction}
											disabled={false}
											position={player.position}
											corners={gameState.track.corners}
											trackLength={gameState.track.length}
											speed={player.speed}
											played={player.played}
											turnActions={player.turnActions}
										/>
									) : gameState.phase === "resolution" && currentTurnPlayer ? (
										<TurnSummary
											player={gameState.players[currentTurnPlayer]}
											currentState={gameState.currentState}
											playerColor={playerColorsLight[gameState.playerOrder.indexOf(currentTurnPlayer) % playerColorsLight.length]}
										/>
									) : (
										<Card>
											<CardContent className="py-6 text-center text-muted-foreground">
												<Badge variant="secondary" className="text-base px-4 py-1">
													{gameState.phase}
												</Badge>
												<p className="mt-3">
													Waiting for other players...
												</p>
											</CardContent>
										</Card>
									)}
									<DeckInfo
										deckSize={player.deckSize}
										engineSize={player.engineSize}
										discardSize={player.discardSize}
									/>
								</div>
							)}
						</main>
					</div>
				</div>
			</div>
		</div>
	);
}
