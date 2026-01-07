import type { GameState } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface PlayerListProps {
	gameState: GameState;
	currentPlayerId: string;
}

export function PlayerList({ gameState, currentPlayerId }: PlayerListProps) {
	const players = Object.values(gameState.players).sort(
		(a, b) => b.position - a.position,
	);

	const isCurrentTurn = (playerId: string): boolean => {
		if (gameState.phase === "planning") {
			return gameState.pendingPlayers[playerId];
		}
		return gameState.turnOrder[gameState.currentPlayerIndex] === playerId;
	};

	return (
		<Card className="min-w-[220px]">
			<CardHeader className="pb-2">
				<CardTitle>Players</CardTitle>
			</CardHeader>
			<CardContent className="space-y-2">
				{players.map((player, index) => (
					<div
						key={player.id}
						className={cn(
							"grid grid-cols-[auto_1fr_auto_auto] items-center gap-2 p-2 rounded-md",
							player.id === currentPlayerId && "bg-blue-500/20",
							isCurrentTurn(player.id) && "border-l-2 border-blue-500",
						)}
					>
						<span className="font-bold">{index + 1}.</span>
						<span className="font-medium">
							{player.id}
							{player.id === currentPlayerId && " (you)"}
						</span>
						{player.finished && <span>🏁</span>}
						<div className="grid grid-cols-3 gap-1">
							<Badge variant="secondary" className="text-xs">
								Gear: {player.gear}
							</Badge>
							<Badge variant="secondary" className="text-xs">
								Pos: {player.position}
							</Badge>
							<Badge variant="secondary" className="text-xs">
								Lap: {player.lap}
							</Badge>
						</div>
					</div>
				))}
			</CardContent>
		</Card>
	);
}
