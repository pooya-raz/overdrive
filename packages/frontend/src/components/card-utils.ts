import type { Card } from "@overdrive/shared";

export function cardLabel(card: Card): string {
	if (card.value !== undefined) {
		return String(card.value);
	}
	if (card.type === "heat") return "H";
	if (card.type === "stress") return "?";
	return "★";
}

export const cardBaseColors: Record<string, string> = {
	speed: "bg-blue-500",
	heat: "bg-red-500",
	stress: "bg-yellow-500",
	upgrade: "bg-purple-500",
};
