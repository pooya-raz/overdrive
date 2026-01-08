import type { Gear } from "@heat/shared";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface GearSelectorProps {
	currentGear: Gear;
	selectedGear: Gear;
	onSelectGear: (gear: Gear) => void;
	disabled?: boolean;
}

const GEARS: Gear[] = [1, 2, 3, 4];

export function GearSelector({
	currentGear,
	selectedGear,
	onSelectGear,
	disabled = false,
}: GearSelectorProps) {
	const isValidGear = (gear: Gear): boolean => {
		return Math.abs(gear - currentGear) <= 2;
	};

	return (
		<div className="grid grid-cols-[auto_repeat(4,auto)] items-center gap-2">
			<span className="font-bold text-foreground">Gear:</span>
			{GEARS.map((gear) => (
				<Button
					key={gear}
					variant="outline"
					size="icon"
					className={cn(
						"rounded-full bg-slate-700 text-white hover:bg-slate-600",
						selectedGear === gear && "ring-2 ring-blue-500 bg-blue-500 border-blue-500",
					)}
					onClick={() => onSelectGear(gear)}
					disabled={disabled || !isValidGear(gear)}
				>
					{gear}
				</Button>
			))}
		</div>
	);
}
