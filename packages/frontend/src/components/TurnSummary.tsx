import type { PlayerData, TurnState } from "@overdrive/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { PlayedCards } from "./PlayedCards";

interface TurnSummaryProps {
	player: PlayerData;
	currentState: TurnState;
	playerColor: string;
}

const phases: TurnState[] = ["move", "adrenaline", "react", "slipstream", "cornerPenalty", "discard"];

function getPhaseDisplay(
	phase: TurnState,
	currentState: TurnState,
	player: PlayerData,
): { status: "pending" | "current" | "done"; label: string } {
	const phaseIndex = phases.indexOf(phase);
	const currentIndex = phases.indexOf(currentState);

	if (phaseIndex > currentIndex) {
		return { status: "pending", label: "" };
	}

	if (phaseIndex === currentIndex) {
		return { status: "current", label: "" };
	}

	// Phase is done - get result
	const { turnActions } = player;

	switch (phase) {
		case "move":
			return { status: "done", label: "✓" };

		case "adrenaline": {
			const adr = turnActions.adrenaline;
			if (!adr || !adr.acceptMove) {
				return { status: "done", label: "✗" };
			}
			return { status: "done", label: "+1 move" };
		}

		case "react": {
			const react = turnActions.react;
			if (!react || react.action === "skip") {
				return { status: "done", label: "✗" };
			}
			if (react.action === "boost" && react.amount !== undefined) {
				return { status: "done", label: `boost +${react.amount}` };
			}
			return { status: "done", label: react.action };
		}

		case "slipstream": {
			const slip = turnActions.slipstream;
			if (!slip || !slip.used) {
				return { status: "done", label: "✗" };
			}
			return { status: "done", label: "✓" };
		}

		case "cornerPenalty": {
			const corner = turnActions.cornerPenalty;
			if (!corner) {
				return { status: "done", label: "✓" };
			}
			if (corner.spinout) {
				return { status: "done", label: "spinout!" };
			}
			const totalHeat = corner.corners.reduce((sum, c) => sum + c.heatPaid, 0);
			return { status: "done", label: `-${totalHeat} heat` };
		}

		case "discard": {
			const disc = turnActions.discard;
			if (!disc || disc.count === 0) {
				return { status: "done", label: "✗" };
			}
			return { status: "done", label: `${disc.count}` };
		}

		default:
			return { status: "done", label: "✓" };
	}
}

export function TurnSummary({ player, currentState, playerColor }: TurnSummaryProps) {
	return (
		<Card style={{ backgroundColor: playerColor }}>
			<CardHeader>
				<CardTitle>{player.username || player.id}'s Turn</CardTitle>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="flex items-center gap-4">
					<PlayedCards cards={player.played} />
					<span className="text-muted-foreground">
						Speed: <span className="font-bold text-foreground">{player.speed}</span>
					</span>
				</div>

				<div className="grid grid-cols-6 gap-1 text-center text-sm">
					{phases.map((phase) => {
						const { status, label } = getPhaseDisplay(phase, currentState, player);
						return (
							<div
								key={phase}
								className={cn(
									"py-2 px-1 rounded border",
									status === "current" && "border-blue-500 bg-blue-500/10",
									status === "done" && "border-muted bg-muted/50",
									status === "pending" && "border-transparent",
								)}
							>
								<div className="font-medium capitalize">{phase}</div>
								<div className="text-muted-foreground h-5">
									{status === "current" ? "..." : label}
								</div>
							</div>
						);
					})}
				</div>
			</CardContent>
		</Card>
	);
}
