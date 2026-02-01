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

export function PlayedCards({ cards }: PlayedCardsProps) {
	return (
		<div className="flex gap-4">
			{cards.map((card, index) => (
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
