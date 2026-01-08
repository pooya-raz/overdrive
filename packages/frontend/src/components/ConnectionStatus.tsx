import { Button } from "@/components/ui/button";

interface ConnectionStatusProps {
	status: "connecting" | "disconnected";
	context: string; // e.g., "lobby" or "room"
	onReconnect?: () => void;
	onBack?: () => void;
}

export function ConnectionStatus({
	status,
	context,
	onReconnect,
	onBack,
}: ConnectionStatusProps) {
	return (
		<div className="min-h-screen grid place-items-center bg-gradient-to-br from-slate-900 to-slate-800 text-white">
			{status === "connecting" ? (
				<p>Connecting to {context}...</p>
			) : (
				<div className="text-center space-y-4">
					<p>Disconnected from {context}</p>
					{onReconnect && <Button onClick={onReconnect}>Reconnect</Button>}
					{onBack && <Button onClick={onBack}>Back to Lobby</Button>}
				</div>
			)}
		</div>
	);
}
