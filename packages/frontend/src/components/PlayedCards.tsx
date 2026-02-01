import type { Card as CardType } from "@overdrive/shared";
import { cn } from "@/lib/utils";
import { cardLabel, cardBaseColors } from "./card-utils";

interface PlayedCardsProps {
	cards: CardType[];
}

export function PlayedCards({ cards }: PlayedCardsProps) {
	return (
		<div className="flex gap-4">
			{cards.map((card, index) => (
				<div key={index} className="relative">
					<div
						className={cn(
							"w-15 h-20 rounded-lg border-2 border-white/20 text-2xl font-bold text-white flex items-center justify-center",
							cardBaseColors[card.type],
						)}
					>
						{cardLabel(card)}
					</div>

					{card.type === "stress" &&
						card.resolution?.drawnCards.map((drawnCard, i) => {
							const isDiscarded = drawnCard.type !== "speed";
							return (
								<div
									key={i}
									className={cn(
										"absolute w-15 h-20 rounded-lg border-2 border-white/20 text-2xl font-bold text-white flex items-center justify-center",
										cardBaseColors[drawnCard.type],
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
