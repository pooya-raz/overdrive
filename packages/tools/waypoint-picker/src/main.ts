interface Waypoint {
  x: number;
  y: number;
}

const waypoints: Waypoint[] = [];

const clickLayer = document.getElementById("click-layer")!;
const markersContainer = document.getElementById("markers")!;
const countDisplay = document.getElementById("count")!;
const outputTextarea = document.getElementById("output") as HTMLTextAreaElement;
const undoBtn = document.getElementById("undo-btn") as HTMLButtonElement;
const clearBtn = document.getElementById("clear-btn") as HTMLButtonElement;
const copyBtn = document.getElementById("copy-btn") as HTMLButtonElement;
const mapBg = document.getElementById("map-bg") as HTMLImageElement;

const MAP_WIDTH = 600;
const MAP_HEIGHT = 399;

function getScaledCoordinates(
  clientX: number,
  clientY: number
): { x: number; y: number } | null {
  const rect = mapBg.getBoundingClientRect();
  const scaleX = MAP_WIDTH / rect.width;
  const scaleY = MAP_HEIGHT / rect.height;

  const x = Math.round((clientX - rect.left) * scaleX);
  const y = Math.round((clientY - rect.top) * scaleY);

  if (x < 0 || x > MAP_WIDTH || y < 0 || y > MAP_HEIGHT) {
    return null;
  }

  return { x, y };
}

function updateDisplay(): void {
  countDisplay.textContent = `${waypoints.length} / 69`;

  const output = `export const usaMapWaypoints: { x: number; y: number }[] = [
${waypoints.map((w, i) => `  { x: ${w.x}, y: ${w.y} },  // position ${i}`).join("\n")}
];`;

  outputTextarea.value = waypoints.length > 0 ? output : "";

  undoBtn.disabled = waypoints.length === 0;
  clearBtn.disabled = waypoints.length === 0;
  copyBtn.disabled = waypoints.length === 0;
}

function renderMarkers(): void {
  const rect = mapBg.getBoundingClientRect();
  const wrapper = document.getElementById("map-wrapper")!;
  const wrapperRect = wrapper.getBoundingClientRect();

  const offsetX = rect.left - wrapperRect.left;
  const offsetY = rect.top - wrapperRect.top;

  const scaleX = rect.width / MAP_WIDTH;
  const scaleY = rect.height / MAP_HEIGHT;

  markersContainer.innerHTML = waypoints
    .map((w, i) => {
      const left = offsetX + w.x * scaleX;
      const top = offsetY + w.y * scaleY;
      return `<div class="marker" style="left: ${left}px; top: ${top}px;">${i}</div>`;
    })
    .join("");
}

function addWaypoint(x: number, y: number): void {
  if (waypoints.length >= 69) {
    alert("All 69 waypoints have been added!");
    return;
  }
  waypoints.push({ x, y });
  updateDisplay();
  renderMarkers();
}

function undo(): void {
  if (waypoints.length > 0) {
    waypoints.pop();
    updateDisplay();
    renderMarkers();
  }
}

function clearAll(): void {
  if (confirm("Clear all waypoints?")) {
    waypoints.length = 0;
    updateDisplay();
    renderMarkers();
  }
}

async function copyOutput(): Promise<void> {
  try {
    await navigator.clipboard.writeText(outputTextarea.value);
    copyBtn.textContent = "Copied!";
    setTimeout(() => {
      copyBtn.textContent = "Copy Output";
    }, 2000);
  } catch {
    alert("Failed to copy. Please select and copy manually.");
  }
}

clickLayer.addEventListener("click", (e) => {
  const coords = getScaledCoordinates(e.clientX, e.clientY);
  if (coords) {
    addWaypoint(coords.x, coords.y);
  }
});

undoBtn.addEventListener("click", undo);
clearBtn.addEventListener("click", clearAll);
copyBtn.addEventListener("click", copyOutput);

window.addEventListener("resize", renderMarkers);
mapBg.addEventListener("load", renderMarkers);

updateDisplay();
