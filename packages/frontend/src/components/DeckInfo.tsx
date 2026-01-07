import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface DeckInfoProps {
	deckSize: number;
	engineSize: number;
	discardSize: number;
}

export function DeckInfo({ deckSize, engineSize, discardSize }: DeckInfoProps) {
	return (
		<Card>
			<CardHeader className="pb-2">
				<CardTitle className="text-lg">Cards</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="grid grid-cols-3 gap-4 text-center">
					<div>
						<p className="text-2xl font-bold text-blue-400">{deckSize}</p>
						<p className="text-sm text-muted-foreground">Deck</p>
					</div>
					<div>
						<p className="text-2xl font-bold text-red-400">{engineSize}</p>
						<p className="text-sm text-muted-foreground">Engine</p>
					</div>
					<div>
						<p className="text-2xl font-bold text-gray-400">{discardSize}</p>
						<p className="text-sm text-muted-foreground">Discard</p>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
