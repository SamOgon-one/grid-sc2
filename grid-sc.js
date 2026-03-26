const canvas = document.getElementById('mapCanvas');
const ctx = canvas.getContext('2d');

let savedMapImage = null;
let mapGridWidth = 0;
let mapGridHeight = 0;
let currentHoverStr = null;
let currentMapData = null;
let statusTimeout = null;

// UI Elements
const mapSelect = document.getElementById('mapSelect');
const jsonInput = document.getElementById('jsonInput');
const statusMessage = document.getElementById('statusMessage');
const cellInfo = document.getElementById('cellInfo');
const zoomInput = document.getElementById('zoomLevel');
const gridCheckbox = document.getElementById('showGrid');
const themeSelect = document.getElementById('themeSelect');
const structSelect = document.getElementById('structSize');
const yourLabelInput = document.getElementById('yourLabel');
const fitWidthBtn = document.getElementById('fitWidthBtn');
const fitHeightBtn = document.getElementById('fitHeightBtn');
const dataDisplay = document.getElementById('dataDisplay');
const undoBtn = document.getElementById('undoBtn');
const mirrorVertBtn = document.getElementById('mirrorVertBtn');
const mirrorHorizBtn = document.getElementById('mirrorHorizBtn');
const saveJsonBtn = document.getElementById('saveJsonBtn');
const mirrorDiagBtn = document.getElementById('mirrorDiagBtn');

let activeMapName = "unknown";

// Help Modal Elements
const openHelp = document.getElementById('openHelp');
const closeHelp = document.getElementById('closeHelp');
const helpModal = document.getElementById('helpModal');
const helpOverlay = document.getElementById('helpOverlay');

const defaultAlpha = 0.75;

// Data Logging & Undo History
let loggedPoints = {
    "1x1": [],
    "2x2": [],
    "3x3": [],
    "5x5": []
};
let clickHistory = [];

// Initial Load
window.onload = function () {
    loadMapFromUrl(mapSelect.value);
};

yourLabelInput.addEventListener('input', () => {
    refreshDisplay();
});

function updateStatus(msg, color = "") {
    statusMessage.innerText = msg;
    statusMessage.style.color = color;
    statusMessage.classList.remove('fade-out');
    if (statusTimeout) clearTimeout(statusTimeout);
    statusTimeout = setTimeout(() => {
        statusMessage.classList.add('fade-out');
    }, 3000);
}

// Help Modal Logic
function toggleHelp(show) {
    helpModal.style.display = show ? 'block' : 'none';
    helpOverlay.style.display = show ? 'block' : 'none';
}

openHelp.addEventListener('click', () => toggleHelp(true));
closeHelp.addEventListener('click', () => toggleHelp(false));
helpOverlay.addEventListener('click', () => toggleHelp(false));

// Theme Switching
themeSelect.addEventListener('change', function () {
    if (this.value === 'dark') {
        document.body.classList.add('dark-mode');
    } else {
        document.body.classList.remove('dark-mode');
    }
    if (currentMapData) renderMap(currentMapData);
});

mapSelect.addEventListener('change', function () {
    loadMapFromUrl(this.value);
});

async function loadMapFromUrl(url) {
    updateStatus("Fetching map data...");
    activeMapName = url.split('/').pop().replace('.json', '');
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error("CORS or 404");
        currentMapData = await response.json();
        renderMap(currentMapData);
        updateStatus(`Active: ${url.split('/').pop()}`);
    } catch (err) {
        updateStatus("Offline: Use 'Map upload' or a local server for dropdown maps.", "#ff6666");
    }
}

jsonInput.addEventListener('change', function (event) {
    const file = event.target.files[0];
    if (!file) return;
    activeMapName = file.name.replace('.json', '');
    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            currentMapData = JSON.parse(e.target.result);
            renderMap(currentMapData);
            updateStatus(`Active: ${file.name}`, "#4db8ff");
            mapSelect.value = "";
        } catch (err) {
            updateStatus("Error: Invalid JSON format", "#ff6666");
        }
    };
    reader.readAsText(file);
});

// Fit Logic
fitWidthBtn.addEventListener('click', () => {
    if (!mapGridWidth) return;
    const container = document.getElementById('canvasContainer');
    const containerWidth = container ? container.clientWidth - 40 : window.innerWidth - 350;
    let newCellSize = Math.floor(containerWidth / mapGridWidth);
    applyNewZoom(newCellSize);
});

fitHeightBtn.addEventListener('click', () => {
    if (!mapGridHeight || !mapGridWidth) return;
    const container = document.getElementById('canvasContainer');
    // Adjust buffer for footer
    const availableHeight = container ? container.clientHeight - 60 : window.innerHeight - 100;
    const availableWidth = container ? container.clientWidth - 40 : window.innerWidth - 350;

    let newCellSize = Math.floor(availableHeight / mapGridHeight);
    if (mapGridWidth * newCellSize > availableWidth) {
        newCellSize = Math.floor(availableWidth / mapGridWidth);
    }
    applyNewZoom(newCellSize);
});

function applyNewZoom(size) {
    if (size < 1) size = 1;
    if (size > 50) size = 50;
    if (size < parseInt(zoomInput.min)) zoomInput.min = size;
    if (size > parseInt(zoomInput.max)) zoomInput.max = size;
    zoomInput.value = size;
    renderMap(currentMapData);
}

// Live reload on control changes
zoomInput.addEventListener('input', () => { if (currentMapData) renderMap(currentMapData); });
gridCheckbox.addEventListener('change', () => { if (currentMapData) renderMap(currentMapData); });
structSelect.addEventListener('change', () => { if (savedMapImage) currentHoverStr = null; });

function renderMap(mapData) {
    if (!mapData.data) return;
    const pHeights = mapData.data.placement || mapData.data.placement_heights;
    const tHeights = mapData.data.pathing || mapData.data.pathing_heights;
    const zHeights = mapData.data.heights;
    if (!pHeights) return;

    if (mapData.playable_area && mapData.playable_area.width && mapData.playable_area.height) {
        mapGridWidth = mapData.playable_area.width;
        mapGridHeight = mapData.playable_area.height;
    } else {
        mapGridWidth = mapData.width || Math.sqrt(pHeights.length);
        mapGridHeight = mapData.height || mapGridWidth;
    }

    const cellSize = parseInt(zoomInput.value);
    canvas.width = mapGridWidth * cellSize;
    canvas.height = mapGridHeight * cellSize;

    let minZ = 255, maxZ = 0;
    let minP = 255, maxP = 0, minT = 255, maxT = 0;

    if (zHeights) {
        for (let i = 0; i < zHeights.length; i++) {
            minZ = Math.min(minZ, zHeights[i]);
            maxZ = Math.max(maxZ, zHeights[i]);
        }
    } else {
        for (let i = 0; i < pHeights.length; i++) {
            if (pHeights[i] > 0) { minP = Math.min(minP, pHeights[i]); maxP = Math.max(maxP, pHeights[i]); }
            if (tHeights[i] > 0) { minT = Math.min(minT, tHeights[i]); maxT = Math.max(maxT, tHeights[i]); }
        }
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < pHeights.length; i++) {
        const p = pHeights[i]; const t = tHeights[i];
        const x = (i % mapGridWidth); const y = Math.floor(i / mapGridWidth);
        const drawY = (mapGridHeight - 1 - y);
        const canvasX = x * cellSize; const canvasY = drawY * cellSize;

        if (p > 0) {
            let intensity;
            if (zHeights) {
                const z = zHeights[i];
                intensity = maxZ > minZ ? Math.floor(((z - minZ) / (maxZ - minZ)) * 87 + 40) : 127;
            } else {
                intensity = maxP > minP ? Math.floor(((p - minP) / (maxP - minP)) * 87 + 40) : 127;
            }
            ctx.fillStyle = `rgba(0, ${intensity}, 0, ${defaultAlpha})`;
            ctx.fillRect(canvasX, canvasY, cellSize, cellSize);
        } else if (t > 0) {
            let intensity;
            if (zHeights) {
                const z = zHeights[i];
                intensity = maxZ > minZ ? Math.floor(((z - minZ) / (maxZ - minZ)) * 87 + 40) : 127;
            } else {
                intensity = maxT > minT ? Math.floor(((t - minT) / (maxT - minT)) * 87 + 40) : 127;
            }
            const greenMix = Math.floor(intensity * 0.6);
            ctx.fillStyle = `rgba(0, ${greenMix}, ${intensity}, ${defaultAlpha})`;
            ctx.fillRect(canvasX, canvasY, cellSize, cellSize);
        }
        if (gridCheckbox.checked) {
            const isDark = document.body.classList.contains('dark-mode');
            ctx.strokeStyle = isDark ? "#333" : "#ddd";
            ctx.lineWidth = 0.2;
            ctx.strokeRect(canvasX, canvasY, cellSize, cellSize);
        }
    }

    drawLoggedBuildings();
    savedMapImage = ctx.getImageData(0, 0, canvas.width, canvas.height);
}

function getGridPos(e) {
    const cellSize = parseInt(zoomInput.value);
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const localX = Math.floor(mouseX / cellSize);
    const localY = mapGridHeight - 1 - Math.floor(mouseY / cellSize);
    const xMargin = currentMapData.playable_area?.x_margin || 0;
    const yMargin = currentMapData.playable_area?.y_margin || 0;
    return { localX, localY, globalX: localX + xMargin, globalY: localY + yMargin };
}

function getOffsets(size) {
    let offsets = [];
    if (size === '3x3') { for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) offsets.push({ dx, dy }); }
    else if (size === '5x5') { for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) offsets.push({ dx, dy }); }
    else if (size === '2x2') { offsets = [{ dx: 0, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: -1 }, { dx: -1, dy: -1 }]; }
    else { offsets = [{ dx: 0, dy: 0 }]; }
    return offsets;
}

function drawLoggedBuildings() {
    const cellSize = parseInt(zoomInput.value);
    const xMargin = currentMapData.playable_area?.x_margin || 0;
    const yMargin = currentMapData.playable_area?.y_margin || 0;

    for (const size in loggedPoints) {
        loggedPoints[size].forEach(pt => {
            const localX = pt.x - xMargin;
            const localY = pt.y - yMargin;
            const offsets = getOffsets(size);

            let minLX = Infinity, maxLX = -Infinity, minLY = Infinity, maxLY = -Infinity;
            offsets.forEach(off => {
                const tx = localX + off.dx; const ty = localY + off.dy;
                if (tx >= 0 && tx < mapGridWidth && ty >= 0 && ty < mapGridHeight) {
                    minLX = Math.min(minLX, tx); maxLX = Math.max(maxLX, tx);
                    minLY = Math.min(minLY, ty); maxLY = Math.max(maxLY, ty);
                    const drawScreenY = (mapGridHeight - 1 - ty);
                    ctx.fillStyle = "rgba(255, 255, 0, 0.7)";
                    ctx.fillRect(tx * cellSize, drawScreenY * cellSize, cellSize, cellSize);
                }
            });

            if (minLX !== Infinity) {
                const drawMinSY = mapGridHeight - 1 - maxLY;
                ctx.strokeStyle = "#000"; ctx.lineWidth = 1.5;
                ctx.strokeRect(minLX * cellSize, drawMinSY * cellSize, (maxLX - minLX + 1) * cellSize, (maxLY - minLY + 1) * cellSize);
            }
        });
    }
}

// Hover/Overlay Logic
canvas.addEventListener('mousemove', function (e) {
    if (!savedMapImage || !currentMapData) return;
    const pos = getGridPos(e);
    if (pos.localX < 0 || pos.localX >= mapGridWidth || pos.localY < 0 || pos.localY >= mapGridHeight) {
        cellInfo.style.display = "none"; return;
    }

    const strucSize = structSelect.value;
    const offsets = getOffsets(strucSize);
    const idx = pos.localY * mapGridWidth + pos.localX;
    const pData = currentMapData.data.placement || currentMapData.data.placement_heights;
    const tData = currentMapData.data.pathing || currentMapData.data.pathing_heights;
    const pValue = pData[idx] || 0;
    const tValue = tData[idx] || 0;
    const zValue = currentMapData.data.heights ? currentMapData.data.heights[idx] : (pValue > 0 ? pValue : (tValue > 0 ? tValue : 0));
    const statusText = pValue > 0 ? "placeable" : (tValue > 0 ? "pathable only" : "Impassable");

    cellInfo.innerHTML = `<strong>X: ${pos.globalX}, Y: ${pos.globalY}, Z: ${zValue}</strong><br>${statusText}`;
    cellInfo.style.display = "block";
    cellInfo.style.left = (e.clientX + 15) + "px";
    cellInfo.style.top = (e.clientY + 15) + "px";

    const hoverStr = `${pos.localX},${pos.localY},${strucSize}`;
    if (hoverStr === currentHoverStr) return;
    currentHoverStr = hoverStr;

    ctx.putImageData(savedMapImage, 0, 0);
    const cellSize = parseInt(zoomInput.value);
    const isDark = document.body.classList.contains('dark-mode');

    let minLX = Infinity, maxLX = -Infinity, minLY = Infinity, maxLY = -Infinity;
    offsets.forEach(off => {
        const tx = pos.localX + off.dx; const ty = pos.localY + off.dy;
        if (tx >= 0 && tx < mapGridWidth && ty >= 0 && ty < mapGridHeight) {
            minLX = Math.min(minLX, tx); maxLX = Math.max(maxLX, tx);
            minLY = Math.min(minLY, ty); maxLY = Math.max(maxLY, ty);
            const drawScreenY = (mapGridHeight - 1 - ty);
            ctx.fillStyle = "rgba(255, 165, 0, 0.7)";
            ctx.fillRect(tx * cellSize, drawScreenY * cellSize, cellSize, cellSize);
        }
    });

    if (minLX !== Infinity) {
        const drawMinSY = mapGridHeight - 1 - maxLY;
        ctx.strokeStyle = isDark ? "#fff" : "#000";
        ctx.lineWidth = 1;
        ctx.strokeRect(minLX * cellSize, drawMinSY * cellSize, (maxLX - minLX + 1) * cellSize, (maxLY - minLY + 1) * cellSize);
    }

    ctx.strokeStyle = "red"; ctx.lineWidth = 1;
    ctx.strokeRect(pos.localX * cellSize, (mapGridHeight - 1 - pos.localY) * cellSize, cellSize, cellSize);
});

canvas.addEventListener('mouseleave', () => {
    cellInfo.style.display = "none";
    if (savedMapImage) ctx.putImageData(savedMapImage, 0, 0);
    currentHoverStr = null;
});

// Click to Log Logic
canvas.addEventListener('click', (e) => {
    if (!currentMapData || helpModal.style.display === 'block') return;
    const pos = getGridPos(e);
    if (pos.localX < 0 || pos.localX >= mapGridWidth || pos.localY < 0 || pos.localY >= mapGridHeight) return;

    const strucSize = structSelect.value;
    loggedPoints[strucSize].push({ x: pos.globalX, y: pos.globalY });
    clickHistory.push(strucSize);
    renderMap(currentMapData);
    refreshDisplay();
    updateStatus(`Logged ${strucSize} at ${pos.globalX},${pos.globalY}`, "#107c10");
});

function refreshDisplay() {
    let text = "";
    for (const key in loggedPoints) {
        if (loggedPoints[key].length > 0) {
            text += `${key} = [${loggedPoints[key].map(p => `(${p.x}, ${p.y})`).join(', ')}]\n\n`;
        }
    }
    dataDisplay.value = text;
}

// Global UI Buttons & Undo
function performUndo() {
    if (clickHistory.length === 0) return;
    const lastSize = clickHistory.pop();
    loggedPoints[lastSize].pop();
    renderMap(currentMapData);
    refreshDisplay();
    updateStatus(`Undone last item.`);
}

saveJsonBtn.addEventListener('click', () => {
    if (Object.values(loggedPoints).every(arr => arr.length === 0)) {
        updateStatus("Nothing to save!", "#ff6666");
        return;
    }
    // Metadata in JSON
    const exportData = {
        map_name: activeMapName,
        ...loggedPoints
    };
    const dataStr = JSON.stringify(exportData, null, 4);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    // Filename logic: input value or grid_plan
    const fileName = (yourLabelInput.value.trim() || "grid_plan") + ".json";
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    updateStatus(`Saved as ${fileName}`, "#107c10");
});

// Mirroring Logic
function mirrorPoints(axis) {
    if (!currentMapData || !currentMapData.playable_area) return;
    const { width, height, x_margin, y_margin } = currentMapData.playable_area;

    for (const size in loggedPoints) {
        loggedPoints[size] = loggedPoints[size].map(pt => {
            if (axis === 'y') {
                // Vertical Mirror: Flip Global Y around playable center
                const localY = pt.y - y_margin;
                const newLocalY = (height - 1) - localY;
                return { x: pt.x, y: newLocalY + y_margin };
            } else if (axis === 'x') {
                // Horizontal Mirror: Flip Global X around playable center
                const localX = pt.x - x_margin;
                const newLocalX = (width - 1) - localX;
                return { x: newLocalX + x_margin, y: pt.y };
            } else if (axis === 'diag') {
                // Diagonal Mirror: Swap X and Y relative to playable center
                // This is a reflection across the line Y=X
                const localX = pt.x - x_margin;
                const localY = pt.y - y_margin;
                // If map is non-square, we map proportionally
                const newLocalX = Math.round(localY * ((width - 1) / (height - 1)));
                const newLocalY = Math.round(localX * ((height - 1) / (width - 1)));
                return { x: newLocalX + x_margin, y: newLocalY + y_margin };
            }
        });
    }
    renderMap(currentMapData);
    refreshDisplay();
    let msg = "";
    if (axis === 'y') msg = "vertically";
    else if (axis === 'x') msg = "horizontally";
    else if (axis === 'diag') msg = "diagonally";
    updateStatus(`Mirrored structures ${msg}.`);
}

mirrorVertBtn.addEventListener('click', () => mirrorPoints('y'));
mirrorHorizBtn.addEventListener('click', () => mirrorPoints('x'));
mirrorDiagBtn.addEventListener('click', () => mirrorPoints('diag'));

dataDisplay.addEventListener('click', () => {
    if (!dataDisplay.value) return;
    navigator.clipboard.writeText(dataDisplay.value).then(() => {
        updateStatus("Coordinates copied to clipboard!", "#107c10");
    });
});

undoBtn.addEventListener('click', performUndo);

window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        performUndo();
    }
    if (e.key === '?' || e.key === '/') {
        toggleHelp(helpModal.style.display !== 'block');
    }
    if (e.key === 'Escape' && helpModal.style.display === 'block') {
        toggleHelp(false);
    }
});