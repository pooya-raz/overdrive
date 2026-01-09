import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface UsernameScreenProps {
	onSubmit: (username: string) => void;
	initialValue: string;
}

export function UsernameScreen({ onSubmit, initialValue }: UsernameScreenProps) {
	const [username, setUsername] = useState(initialValue);

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (username.trim()) {
			onSubmit(username.trim());
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
							placeholder="Enter your username"
							value={username}
							onChange={(e) => setUsername(e.target.value)}
							autoFocus
							maxLength={20}
							className="w-full px-4 py-3 rounded-md border bg-background text-center text-lg"
						/>
						<Button
							type="submit"
							disabled={!username.trim()}
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
