import { useState } from "react";
import type { Action, Card as CardType, Corner, Gear, TurnState } from "@overdrive/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { GearSelector } from "./GearSelector";
import { Hand } from "./Hand";

interface ActionPanelProps {
	currentState: TurnState;
	hand: CardType[];
	currentGear: Gear;
	availableCooldowns: number;
	onAction: (action: Action) => void;
	disabled: boolean;
	position: number;
	corners: Corner[];
	trackLength: number;
	speed: number;
}

export function ActionPanel({
	currentState,
	hand,
	currentGear,
	availableCooldowns,
	onAction,
	disabled,
	position,
	corners,
	trackLength,
	speed,
}: ActionPanelProps) {
	const [selectedGear, setSelectedGear] = useState<Gear>(currentGear);
	const [selectedCards, setSelectedCards] = useState<number[]>([]);
	const [adrenalineMove, setAdrenalineMove] = useState(false);
	const [adrenalineCooldown, setAdrenalineCooldown] = useState(false);

	const getNextCorner = (): { distance: number; speedLimit: number } | null => {
		const posInTrack = ((position % trackLength) + trackLength) % trackLength;
		for (const corner of corners) {
			if (corner.position > posInTrack) {
				return { distance: corner.position - posInTrack, speedLimit: corner.speedLimit };
			}
		}
		if (corners.length > 0) {
			return { distance: corners[0].position + trackLength - posInTrack, speedLimit: corners[0].speedLimit };
		}
		return null;
	};

	const nextCorner = getNextCorner();

	const handleGearChange = (gear: Gear) => {
		setSelectedGear(gear);
		setSelectedCards((prev) => prev.slice(0, gear));
	};

	const toggleCard = (index: number) => {
		setSelectedCards((prev) => {
			if (prev.includes(index)) {
				return prev.filter((i) => i !== index);
			}
			if (prev.length >= selectedGear) {
				return prev;
			}
			return [...prev, index];
		});
	};

	const toggleDiscardCard = (index: number) => {
		setSelectedCards((prev) =>
			prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index],
		);
	};

	const heatCardIndices = hand
		.map((card, index) => (card.type === "heat" ? index : -1))
		.filter((i) => i !== -1);

	const nonDiscardableIndices = hand
		.map((card, index) => (card.type === "heat" || card.type === "stress" ? index : -1))
		.filter((i) => i !== -1);

	const handlePlan = () => {
		onAction({ type: "plan", gear: selectedGear, cardIndices: selectedCards });
		setSelectedCards([]);
	};

	const handleDiscard = () => {
		onAction({ type: "discard", cardIndices: selectedCards });
		setSelectedCards([]);
	};

	if (currentState === "plan") {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Planning Phase</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					{nextCorner && (
						<p className="text-black">
							Next corner in <span className="font-bold text-yellow-400">{nextCorner.distance}</span> spaces (speed limit: {nextCorner.speedLimit})
						</p>
					)}
					<GearSelector
						currentGear={currentGear}
						selectedGear={selectedGear}
						onSelectGear={handleGearChange}
						disabled={disabled}
					/>
					<div className="space-y-2">
						<label className="text-sm font-medium">Select cards to play:</label>
						<Hand
							cards={hand}
							selectedIndices={selectedCards}
							onToggleCard={toggleCard}
							disabled={disabled}
							disabledIndices={heatCardIndices}
						/>
					</div>
					<Button
						onClick={handlePlan}
						disabled={disabled || selectedCards.length === 0}
						className="w-full text-white hover:text-blue-500"
					>
						Confirm Plan
					</Button>
				</CardContent>
			</Card>
		);
	}

	if (currentState === "move") {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Move</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					<p className="text-black">You move <span className="font-bold text-blue-400">{speed}</span> {speed === 1 ? "space" : "spaces"}.</p>
					<Button
						onClick={() => onAction({ type: "move" })}
						disabled={disabled}
						className="w-full text-white hover:text-blue-500"
					>
						Move
					</Button>
				</CardContent>
			</Card>
		);
	}

	if (currentState === "adrenaline") {
		const handleAdrenalineConfirm = () => {
			onAction({
				type: "adrenaline",
				acceptMove: adrenalineMove,
				acceptCooldown: adrenalineCooldown,
			});
			setAdrenalineMove(false);
			setAdrenalineCooldown(false);
		};

		return (
			<Card>
				<CardHeader>
					<CardTitle>Adrenaline</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					<p className="text-white">You have adrenaline! Select your bonus(es):</p>
					<div className="grid grid-cols-2 gap-2">
						<Button
							className={cn(
								"bg-slate-700 text-white hover:bg-slate-600",
								adrenalineMove && "ring-2 ring-blue-500 bg-blue-500",
							)}
							onClick={() => setAdrenalineMove(!adrenalineMove)}
							disabled={disabled}
						>
							+1 Move
						</Button>
						<Button
							className={cn(
								"bg-slate-700 text-white hover:bg-slate-600",
								adrenalineCooldown && "ring-2 ring-blue-500 bg-blue-500",
							)}
							onClick={() => setAdrenalineCooldown(!adrenalineCooldown)}
							disabled={disabled}
						>
							Cooldown
						</Button>
					</div>
					<Button
						onClick={handleAdrenalineConfirm}
						disabled={disabled}
						className="w-full text-white hover:text-blue-500"
					>
						{adrenalineMove || adrenalineCooldown ? "Confirm" : "Skip"}
					</Button>
				</CardContent>
			</Card>
		);
	}

	if (currentState === "react") {
		return (
			<Card>
				<CardHeader>
					<CardTitle>React</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					<p className="text-white">Choose your reaction:</p>
					<div className="grid grid-cols-3 gap-2">
						{(() => {
							const heatInHand = hand.filter((c) => c.type === "heat").length;
							const applicableCooldowns = Math.min(availableCooldowns, heatInHand);
							return applicableCooldowns > 0 ? (
								<Button
									className="bg-slate-700 text-white hover:bg-slate-600"
									onClick={() => onAction({ type: "react", action: "cooldown" })}
									disabled={disabled}
								>
									Cooldown ({applicableCooldowns})
								</Button>
							) : null;
						})()}
						<Button
							className="bg-slate-700 text-white hover:bg-slate-600"
							onClick={() => onAction({ type: "react", action: "boost" })}
							disabled={disabled}
						>
							Boost
						</Button>
						<Button
							className="bg-slate-700 text-white hover:bg-slate-600"
							onClick={() => onAction({ type: "react", action: "skip" })}
							disabled={disabled}
						>
							Skip
						</Button>
					</div>
				</CardContent>
			</Card>
		);
	}

	if (currentState === "slipstream") {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Slipstream</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					<p className="text-white">Use slipstream to move +2?</p>
					<div className="grid grid-cols-2 gap-2">
						<Button
							className="bg-slate-700 text-white hover:bg-slate-600"
							onClick={() => onAction({ type: "slipstream", use: true })}
							disabled={disabled}
						>
							Use Slipstream
						</Button>
						<Button
							className="bg-slate-700 text-white hover:bg-slate-600"
							onClick={() => onAction({ type: "slipstream", use: false })}
							disabled={disabled}
						>
							Skip
						</Button>
					</div>
				</CardContent>
			</Card>
		);
	}

	if (currentState === "discard") {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Discard</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					<p className="text-white">
						Select cards to discard (optional):
					</p>
					<Hand
						cards={hand}
						selectedIndices={selectedCards}
						onToggleCard={toggleDiscardCard}
						disabled={disabled}
						disabledIndices={nonDiscardableIndices}
					/>
					<Button onClick={handleDiscard} disabled={disabled} className="w-full text-white hover:text-blue-500">
						{selectedCards.length > 0
							? `Discard ${selectedCards.length} card(s)`
							: "Skip Discard"}
					</Button>
				</CardContent>
			</Card>
		);
	}

	return null;
}
