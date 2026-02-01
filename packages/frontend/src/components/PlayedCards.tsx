import type { Card as CardType } from "@overdrive/shared";
import { cn } from "@/lib/utils";

interface PlayedCardsProps {
	cards: CardType[];
}

function cardLabel(card: CardType): string {
	if (card.value !== undefined) {
		return String(card.value);
	}
	if (card.type === "heat") return "H";
	if (card.type === "stress") return "?";
	return "★";
}

const cardColors: Record<string, string> = {
	speed: "bg-blue-500",
	heat: "bg-red-500",
	stress: "bg-yellow-500",
	upgrade: "bg-purple-500",
};

function cardSignature(card: CardType): string {
	return `${card.type}:${card.value ?? ""}`;
}

export function PlayedCards({ cards }: PlayedCardsProps) {
	// Count resolved cards by signature (to filter duplicates)
	const resolvedCounts = new Map<string, number>();
	for (const card of cards) {
		if (card.type === "stress" && card.resolution) {
			for (const drawn of card.resolution.drawnCards) {
				if (drawn.type === "speed" || drawn.type === "upgrade") {
					const sig = cardSignature(drawn);
					resolvedCounts.set(sig, (resolvedCounts.get(sig) ?? 0) + 1);
				}
			}
		}
	}

	// Filter out cards already shown in stress cascades
	const skipped = new Map<string, number>();
	const visibleCards = cards.filter((card) => {
		if (card.type !== "speed" && card.type !== "upgrade") return true;
		const sig = cardSignature(card);
		const resolvedCount = resolvedCounts.get(sig) ?? 0;
		const skippedCount = skipped.get(sig) ?? 0;
		if (skippedCount < resolvedCount) {
			skipped.set(sig, skippedCount + 1);
			return false;
		}
		return true;
	});

	return (
		<div className="flex gap-4">
			{visibleCards.map((card, index) => (
				<div key={index} className="relative">
					{/* Base card */}
					<div
						className={cn(
							"w-15 h-20 rounded-lg border-2 border-white/20 text-2xl font-bold text-white flex items-center justify-center",
							cardColors[card.type],
						)}
					>
						{cardLabel(card)}
					</div>

					{/* Cascading resolution cards for stress */}
					{card.type === "stress" &&
						card.resolution?.drawnCards.map((drawnCard, i) => {
							const isDiscarded =
								drawnCard.type === "heat" || drawnCard.type === "stress";
							return (
								<div
									key={i}
									className={cn(
										"absolute w-15 h-20 rounded-lg border-2 border-white/20 text-2xl font-bold text-white flex items-center justify-center",
										cardColors[drawnCard.type],
										isDiscarded && "opacity-50",
									)}
									style={{
										top: `${-(i + 1) * 8}px`,
										left: `${(i + 1) * 12}px`,
									}}
								>
									{cardLabel(drawnCard)}
								</div>
							);
						})}
				</div>
			))}
		</div>
	);
}
