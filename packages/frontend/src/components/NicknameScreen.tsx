import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface NicknameScreenProps {
	onSubmit: (nickname: string) => void;
	initialValue: string;
}

export function NicknameScreen({ onSubmit, initialValue }: NicknameScreenProps) {
	const [nickname, setNickname] = useState(initialValue);

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (nickname.trim()) {
			onSubmit(nickname.trim());
		}
	};

	return (
		<div className="min-h-screen w-full grid place-items-center p-6 bg-gradient-to-br from-slate-900 to-slate-800">
			<Card className="w-full max-w-md">
				<CardHeader className="text-center">
					<CardTitle className="text-3xl">Heat</CardTitle>
				</CardHeader>
				<CardContent>
					<form onSubmit={handleSubmit} className="space-y-4">
						<input
							type="text"
							placeholder="Enter your nickname"
							value={nickname}
							onChange={(e) => setNickname(e.target.value)}
							autoFocus
							maxLength={20}
							className="w-full px-4 py-3 rounded-md border bg-background text-center text-lg"
						/>
						<Button
							type="submit"
							disabled={!nickname.trim()}
							className="w-full"
							size="lg"
						>
							Continue
						</Button>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}
