import type { Card as CardType } from "@heat/shared";
import { cn } from "@/lib/utils";

interface HandProps {
	cards: CardType[];
	selectedIndices: number[];
	onToggleCard: (index: number) => void;
	disabled?: boolean;
	disabledIndices?: number[];
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
	speed: "bg-blue-500 hover:bg-blue-600",
	heat: "bg-red-500 hover:bg-red-600",
	stress: "bg-yellow-500 hover:bg-yellow-600",
	upgrade: "bg-purple-500 hover:bg-purple-600",
};

export function Hand({
	cards,
	selectedIndices,
	onToggleCard,
	disabled = false,
	disabledIndices = [],
}: HandProps) {
	return (
		<div className="grid grid-cols-7 gap-2">
			{cards.map((card, index) => {
				const isDisabled = disabled || disabledIndices.includes(index);
				return (
					<button
						key={index}
						className={cn(
							"w-15 h-20 rounded-lg border-2 border-white/20 text-2xl font-bold text-white cursor-pointer transition-transform",
							cardColors[card.type],
							selectedIndices.includes(index) &&
								"-translate-y-2 shadow-lg border-white",
							isDisabled && "opacity-50 cursor-not-allowed",
						)}
						onClick={() => onToggleCard(index)}
						disabled={isDisabled}
						type="button"
					>
						{cardLabel(card)}
					</button>
				);
			})}
		</div>
	);
}
