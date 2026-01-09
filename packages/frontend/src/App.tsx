import { useState } from "react";
import { UsernameScreen } from "@/components/UsernameScreen";
import { LobbyScreen } from "@/components/LobbyScreen";
import { RoomScreen } from "@/components/RoomScreen";

type AppScreen =
	| { type: "username" }
	| { type: "lobby" }
	| { type: "room"; roomId: string; roomName: string };

const ROOM_STORAGE_KEY = "heat-current-room";

function getInitialScreen(): AppScreen {
	const savedUsername = localStorage.getItem("heat-username");
	if (!savedUsername) {
		return { type: "username" };
	}

	// Check if we were in a room (for rejoin after refresh)
	const savedRoom = localStorage.getItem(ROOM_STORAGE_KEY);
	if (savedRoom) {
		try {
			const { roomId, roomName } = JSON.parse(savedRoom);
			if (roomId && roomName) {
				return { type: "room", roomId, roomName };
			}
		} catch {
			localStorage.removeItem(ROOM_STORAGE_KEY);
		}
	}

	return { type: "lobby" };
}

function App() {
	const [screen, setScreen] = useState<AppScreen>(getInitialScreen);
	const [username, setUsername] = useState(() =>
		localStorage.getItem("heat-username") || "",
	);

	const handleUsernameSubmit = (name: string) => {
		setUsername(name);
		localStorage.setItem("heat-username", name);
		setScreen({ type: "lobby" });
	};

	const handleJoinRoom = (roomId: string, roomName: string) => {
		localStorage.setItem(ROOM_STORAGE_KEY, JSON.stringify({ roomId, roomName }));
		setScreen({ type: "room", roomId, roomName });
	};

	const handleLeaveRoom = () => {
		localStorage.removeItem(ROOM_STORAGE_KEY);
		setScreen({ type: "lobby" });
	};

	const handleChangeUsername = () => {
		setScreen({ type: "username" });
	};

	if (screen.type === "username" || !username) {
		return (
			<UsernameScreen onSubmit={handleUsernameSubmit} initialValue={username} />
		);
	}

	if (screen.type === "lobby") {
		return (
			<LobbyScreen
				username={username}
				onJoinRoom={handleJoinRoom}
				onChangeUsername={handleChangeUsername}
			/>
		);
	}

	if (screen.type === "room") {
		return (
			<RoomScreen
				roomId={screen.roomId}
				roomName={screen.roomName}
				username={username}
				onLeave={handleLeaveRoom}
			/>
		);
	}

	return null;
}

export default App;
