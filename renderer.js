const canvas = new fabric.Canvas('c', {
    width: window.innerWidth, height: window.innerHeight,
    isDrawingMode: false, selection: true
});

canvas.targetFindTolerance = 10;

// State Variables
let currentTool = 'select'; 
let isDarkMode = true;
let spacePressed = false;

// Properties
let pStroke = '#ffffff'; 
let pBg = 'transparent';
let pWidth = 5;
let pStyle = 'solid'; 
let pFont = 'sans-serif';
let pSize = 24;
let pAlign = 'left';
let pOpacity = 1;

// Drawing States
let isPanning = false; let lastPosX, lastPosY;
let isDrawingShape = false; let startX, startY; let activeShape = null;

// ERASER STATES
let isErasing = false; 
let markedForDeletion = new Set();
let eraserTrail = []; 

// --- HISTORY (UNDO/REDO) & CAMERA SAVING LOGIC ---
let historyStack = [];
let historyIndex = -1;
let isHistoryLocked = false; 

const MAX_HISTORY = 50;

function saveHistory() {
    if (isHistoryLocked) return;
    
    historyStack = historyStack.slice(0, historyIndex + 1);
    
    let state = canvas.toJSON();
    state.camera = canvas.viewportTransform; 
    
    historyStack.push(JSON.stringify(state));
    
    // Prevent memory leaks by capping the history stack
    if (historyStack.length > MAX_HISTORY) {
        historyStack.shift(); 
    } else {
        historyIndex++;
    }
}

function loadHistory(index) {
    if (index < 0 || index >= historyStack.length) return;
    isHistoryLocked = true;
    let state = JSON.parse(historyStack[index]);
    
    canvas.loadFromJSON(state, () => {
        if(state.camera) canvas.setViewportTransform(state.camera);
        canvas.renderAll();
        isHistoryLocked = false;
        historyIndex = index;
        updateZoomUI();
    });
}

document.getElementById('undo-btn').addEventListener('click', () => loadHistory(historyIndex - 1));
document.getElementById('redo-btn').addEventListener('click', () => loadHistory(historyIndex + 1));

saveHistory();
canvas.on('object:modified', saveHistory);
canvas.on('path:created', saveHistory);

// --- CTRL + V IMAGE PASTING ---
window.addEventListener('paste', (e) => {
    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    for (let index in items) {
        const item = items[index];
        if (item.kind === 'file' && item.type.startsWith('image/')) {
            const blob = item.getAsFile();
            const reader = new FileReader();
            reader.onload = function(f) {
                fabric.Image.fromURL(f.target.result, function(img) {
                    let center = { 
                        x: (canvas.width/2)/canvas.getZoom() - canvas.viewportTransform[4]/canvas.getZoom(), 
                        y: (canvas.height/2)/canvas.getZoom() - canvas.viewportTransform[5]/canvas.getZoom() 
                    };
                    if(img.width > 800) img.scaleToWidth(800);
                    img.set({ left: center.x - (img.getScaledWidth()/2), top: center.y - (img.getScaledHeight()/2) });
                    canvas.add(img); canvas.setActiveObject(img); canvas.renderAll(); saveHistory();
                    document.getElementById('select-tool').click(); 
                });
            };
            reader.readAsDataURL(blob);
        }
    }
});

// --- DYNAMIC UI & CUSTOM CURSOR INJECTION ---
function updateCursor() {
    const svgWhite = encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><path d="M8 0v16M0 8h16" stroke="white" stroke-width="2"/></svg>');
    const svgBlack = encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><path d="M8 0v16M0 8h16" stroke="black" stroke-width="2"/></svg>');
    const customCrosshair = `url('data:image/svg+xml;charset=utf-8,${isDarkMode ? svgWhite : svgBlack}') 8 8, crosshair`;

    const eraserCircle = encodeURIComponent(`<svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="6" cy="6" r="4.5" stroke="${isDarkMode ? 'white' : 'black'}" stroke-width="1.5" fill="none"/></svg>`);
    const customEraser = `url('data:image/svg+xml;charset=utf-8,${eraserCircle}') 6 6, cell`;

    canvas.freeDrawingCursor = customCrosshair;
    
    if (spacePressed || currentTool === 'pan') canvas.defaultCursor = 'grab';
    else if (currentTool === 'eraser') canvas.defaultCursor = customEraser;
    else if (currentTool === 'text') canvas.defaultCursor = 'text';
    else if (['laser', 'rect', 'circle', 'line', 'arrow'].includes(currentTool)) canvas.defaultCursor = customCrosshair;
    else canvas.defaultCursor = 'default';
    
    canvas.requestRenderAll();
}

function updateUIForTool() {
    const allGroups = ['pg-stroke', 'pg-bg', 'pg-width', 'pg-style', 'pg-font', 'pg-size', 'pg-align', 'pg-opacity', 'pg-layers'];
    allGroups.forEach(id => document.getElementById(id).style.display = 'none');
    
    if (currentTool === 'select') {
        allGroups.forEach(id => document.getElementById(id).style.display = 'flex');
    } else if (currentTool === 'draw' || currentTool === 'line' || currentTool === 'arrow') {
        ['pg-stroke', 'pg-width', 'pg-style', 'pg-opacity'].forEach(id => document.getElementById(id).style.display = 'flex');
    } else if (currentTool === 'rect' || currentTool === 'circle') {
        ['pg-stroke', 'pg-bg', 'pg-width', 'pg-style', 'pg-opacity'].forEach(id => document.getElementById(id).style.display = 'flex');
    } else if (currentTool === 'text') {
        ['pg-stroke', 'pg-font', 'pg-size', 'pg-align', 'pg-opacity'].forEach(id => document.getElementById(id).style.display = 'flex');
    }
    updateCursor();
}
updateUIForTool(); 

const toolButtons = document.querySelectorAll('#toolbar button, #toolbar label');
function setTargetButton(activeId) {
    toolButtons.forEach(btn => btn.classList.remove('active'));
    if(document.getElementById(activeId)) document.getElementById(activeId).classList.add('active');
    updateUIForTool();
}

let resizeTimer;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
        canvas.setWidth(window.innerWidth); 
        canvas.setHeight(window.innerHeight); 
        canvas.renderAll();
    }, 150); // Waits 150ms after the user stops dragging
});

// --- TRACKPAD PANNING & ZOOMING UI ---
const zoomText = document.getElementById('zoom-text');

function updateZoomUI() { zoomText.innerText = Math.round(canvas.getZoom() * 100) + '%'; }

function applyZoom(newZoom, point) {
    if (newZoom > 20) newZoom = 20; if (newZoom < 0.05) newZoom = 0.05;
    if(point) canvas.zoomToPoint(point, newZoom); else canvas.setZoom(newZoom);
    updateZoomUI();
}

document.getElementById('zoom-in').addEventListener('click', () => applyZoom(canvas.getZoom() * 1.2));
document.getElementById('zoom-out').addEventListener('click', () => applyZoom(canvas.getZoom() / 1.2));

canvas.on('mouse:wheel', function(opt) {
    const e = opt.e; 
    e.preventDefault(); 
    e.stopPropagation();
    
    if (e.ctrlKey) {
        // Normalizes the zoom speed using an exponential curve for smooth scaling
        let zoomMultiplier = Math.exp(-e.deltaY * 0.005); 
        let zoom = canvas.getZoom() * zoomMultiplier;
        applyZoom(zoom, { x: e.offsetX, y: e.offsetY });
    } else {
        // Smooth panning
        let vpt = canvas.viewportTransform; 
        vpt[4] -= e.deltaX; 
        vpt[5] -= e.deltaY; 
        canvas.requestRenderAll();
    }
});

// --- NATIVE FILE SYSTEM SAVE & LOAD LOGIC ---
const menuBtn = document.getElementById('menu-btn');
const dropdown = document.getElementById('dropdown-menu');

menuBtn.addEventListener('click', (e) => { e.stopPropagation(); dropdown.classList.toggle('show'); });
document.addEventListener('click', () => dropdown.classList.remove('show'));

document.getElementById('menu-save').addEventListener('click', async () => {
    let state = canvas.toJSON();
    state.camera = canvas.viewportTransform;
    const json = JSON.stringify(state);

    try {
        const handle = await window.showSaveFilePicker({
            suggestedName: `my-drawing-${Date.now()}.board`,
            types: [{ description: 'Whiteboard File', accept: { 'application/json': ['.board'] } }]
        });
        const writable = await handle.createWritable();
        await writable.write(json);
        await writable.close();
    } catch (err) {}
});

document.getElementById('menu-open').addEventListener('click', async () => {
    try {
        const [fileHandle] = await window.showOpenFilePicker({
            types: [{ description: 'Whiteboard File', accept: { 'application/json': ['.board', '.json'] } }]
        });
        const file = await fileHandle.getFile();
        const text = await file.text();
        
        let state = JSON.parse(text);
        canvas.loadFromJSON(state, () => {
            if(state.camera) canvas.setViewportTransform(state.camera);
            canvas.renderAll(); 
            updateZoomUI(); 
            saveHistory();
        });
    } catch (err) {}
});

document.getElementById('menu-export').addEventListener('click', () => {
    canvas.discardActiveObject(); canvas.renderAll();
    const a = document.createElement('a'); a.href = canvas.toDataURL({ format: 'png', quality: 1.0 });
    a.download = `export-${Date.now()}.png`; a.click();
});

document.getElementById('menu-reset').addEventListener('click', () => {
    if(confirm('Clear the entire board?')) {
        canvas.clear(); canvas.setViewportTransform([1,0,0,1,0,0]); updateZoomUI();
        document.getElementById('select-tool').click(); saveHistory();
    }
});

// THEME TOGGLE 
document.getElementById('menu-theme').addEventListener('click', () => {
    isDarkMode = !isDarkMode; document.body.classList.toggle('light-theme', !isDarkMode);
    const icon = document.querySelector('#menu-theme i');
    const primarySwatch = document.getElementById('primary-swatch');
    
    if (!isDarkMode) {
        icon.classList.replace('fa-moon', 'fa-sun');
        canvas.setBackgroundColor('#f3f4f6', canvas.renderAll.bind(canvas));
        primarySwatch.dataset.val = '#000000'; primarySwatch.style.background = '#000000';
        if (pStroke === '#ffffff') { pStroke = '#000000'; canvas.freeDrawingBrush.color = pStroke; }
    } else {
        icon.classList.replace('fa-sun', 'fa-moon');
        canvas.setBackgroundColor('#121212', canvas.renderAll.bind(canvas));
        primarySwatch.dataset.val = '#ffffff'; primarySwatch.style.background = '#ffffff';
        if (pStroke === '#000000') { pStroke = '#ffffff'; canvas.freeDrawingBrush.color = pStroke; }
    }
    updateCursor(); 
});

// --- PROPERTY CLICK HANDLERS ---
function setupSwatches(containerId, stateVarName) {
    const container = document.getElementById(containerId);
    container.addEventListener('click', (e) => {
        const btn = e.target.closest('.swatch, .toggle-btn');
        if (!btn) return;
        
        Array.from(container.children).forEach(c => c.classList.remove('selected'));
        btn.classList.add('selected');
        
        const val = btn.dataset.val;
        if(stateVarName === 'pStroke') pStroke = val;
        if(stateVarName === 'pBg') pBg = val;
        if(stateVarName === 'pWidth') pWidth = parseInt(val);
        if(stateVarName === 'pStyle') pStyle = val;
        if(stateVarName === 'pFont') pFont = val;
        if(stateVarName === 'pSize') pSize = parseInt(val);
        if(stateVarName === 'pAlign') pAlign = val;
        
        if(stateVarName === 'pStroke') canvas.freeDrawingBrush.color = pStroke;
        if(stateVarName === 'pWidth') canvas.freeDrawingBrush.width = pWidth;

        const obj = canvas.getActiveObject();
        if (obj) {
            let updates = {};
            if(stateVarName === 'pStroke') updates.stroke = pStroke;
            if(stateVarName === 'pBg' && (obj.type === 'rect' || obj.type === 'circle')) updates.fill = pBg;
            if(stateVarName === 'pWidth') updates.strokeWidth = pWidth;
            if(stateVarName === 'pStyle') {
                if(pStyle === 'solid') updates.strokeDashArray = null;
                if(pStyle === 'dashed') updates.strokeDashArray = [pWidth*3, pWidth*3];
                if(pStyle === 'dotted') updates.strokeDashArray = [pWidth, pWidth*2];
            }
            if(stateVarName === 'pFont' && obj.type === 'i-text') updates.fontFamily = pFont;
            if(stateVarName === 'pSize' && obj.type === 'i-text') updates.fontSize = pSize;
            if(stateVarName === 'pAlign' && obj.type === 'i-text') updates.textAlign = pAlign;
            if(stateVarName === 'pStroke' && obj.type === 'i-text') { updates.fill = pStroke; updates.stroke = null; }
            
            obj.set(updates); canvas.renderAll(); saveHistory();
        }
    });
}

setupSwatches('stroke-colors', 'pStroke'); setupSwatches('bg-colors', 'pBg');
setupSwatches('stroke-widths', 'pWidth'); setupSwatches('stroke-styles', 'pStyle');
setupSwatches('font-families', 'pFont'); setupSwatches('font-sizes', 'pSize');
setupSwatches('text-aligns', 'pAlign');

document.getElementById('opacity-slider').addEventListener('input', (e) => {
    pOpacity = parseFloat(e.target.value);
    const obj = canvas.getActiveObject();
    if(obj) { obj.set({opacity: pOpacity}); canvas.renderAll(); }
});
document.getElementById('opacity-slider').addEventListener('change', () => { if(canvas.getActiveObject()) saveHistory(); });

// Layer Controls
document.getElementById('layer-bottom').addEventListener('click', () => { if(canvas.getActiveObject()) { canvas.sendToBack(canvas.getActiveObject()); canvas.renderAll(); saveHistory();} });
document.getElementById('layer-down').addEventListener('click', () => { if(canvas.getActiveObject()) { canvas.sendBackwards(canvas.getActiveObject()); canvas.renderAll(); saveHistory();} });
document.getElementById('layer-up').addEventListener('click', () => { if(canvas.getActiveObject()) { canvas.bringForward(canvas.getActiveObject()); canvas.renderAll(); saveHistory();} });
document.getElementById('layer-top').addEventListener('click', () => { if(canvas.getActiveObject()) { canvas.bringToFront(canvas.getActiveObject()); canvas.renderAll(); saveHistory();} });

// --- TOOL SELECTION EVENTS ---
['select', 'pan', 'draw', 'laser', 'text', 'rect', 'circle', 'line', 'arrow', 'eraser'].forEach(tool => {
    document.getElementById(`${tool}-tool`).addEventListener('click', () => {
        currentTool = tool; 
        canvas.isDrawingMode = (tool === 'draw');
        canvas.selection = (tool === 'select');
        canvas.forEachObject(obj => obj.selectable = (tool === 'select'));
        setTargetButton(`${tool}-tool`);
        
        if (tool === 'draw') {
            canvas.freeDrawingBrush.color = pStroke;
            canvas.freeDrawingBrush.width = pWidth;
        }
    });
});

// --- LASER & ERASER ANIMATION ENGINE ---
let laserTrail = [];
let isLaserActive = false;
const LASER_DURATION = 1200; 

function animateTrails() {
    let needsRender = false;
    const now = Date.now();
    
    if (laserTrail.length > 0) {
        laserTrail = laserTrail.filter(p => now - p.time < LASER_DURATION); 
        needsRender = true;
    }
    if (eraserTrail.length > 0) {
        // Eraser trail fades away rapidly (250ms tail)
        eraserTrail = eraserTrail.filter(p => now - p.time < 250);
        needsRender = true;
    }
    
    if (needsRender) canvas.requestRenderAll(); 
    requestAnimationFrame(animateTrails);
}
animateTrails();

canvas.on('after:render', function(opt) {
    const ctx = opt.ctx;
    ctx.save();
    const vpt = canvas.viewportTransform;
    ctx.transform(vpt[0], vpt[1], vpt[2], vpt[3], vpt[4], vpt[5]);
    ctx.lineJoin = 'round'; 
    ctx.lineCap = 'round';

    // Laser Path Rendering
    if (laserTrail.length > 1) {
        for (let i = 1; i < laserTrail.length; i++) {
            const p0 = laserTrail[i-1]; const p1 = laserTrail[i];
            const age = Date.now() - p1.time; 
            const life = Math.max(0, 1 - (age / LASER_DURATION)); 
            ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y);
            ctx.lineWidth = 4 * life; 
            ctx.strokeStyle = '#ff0000'; 
            ctx.stroke();
        }
    }
    
    // Eraser Path Rendering (Now acts like a short fading tail)
    if (isErasing && eraserTrail.length > 1) {
        ctx.beginPath();
        ctx.moveTo(eraserTrail[0].x, eraserTrail[0].y);
        for (let i = 1; i < eraserTrail.length; i++) {
            ctx.lineTo(eraserTrail[i].x, eraserTrail[i].y);
        }
        // Thickness perfectly balanced at 6
        ctx.lineWidth = 6; 
        ctx.strokeStyle = isDarkMode ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.3)'; 
        ctx.stroke();
    }

    ctx.restore();
});

// --- CANVAS MOUSE EVENTS ---
function getDashArray() {
    if(pStyle === 'dashed') return [pWidth*3, pWidth*3];
    if(pStyle === 'dotted') return [pWidth, pWidth*2];
    return null;
}

canvas.on('mouse:down', function(opt) {
    const pointer = canvas.getPointer(opt.e);
    
    if (currentTool === 'pan' || spacePressed || opt.e.altKey) {
        isPanning = true; lastPosX = opt.e.clientX; lastPosY = opt.e.clientY; return;
    }
    
    if (currentTool === 'eraser') {
        isErasing = true; 
        markedForDeletion.clear();
        // Capture time so the tail can naturally decay
        eraserTrail = [{ x: pointer.x, y: pointer.y, time: Date.now() }];
        
        canvas.getObjects().forEach(obj => {
            if (obj.containsPoint(pointer)) { 
                obj.set({ opacity: 0.2 }); 
                markedForDeletion.add(obj);
            }
        });
        canvas.requestRenderAll();
    }
    
    if (currentTool === 'laser') {
        isLaserActive = true; laserTrail.push({ x: pointer.x, y: pointer.y, time: Date.now() });
    }
    if (currentTool === 'text') {
        const text = new fabric.IText('', {
            left: pointer.x, top: pointer.y, fill: pStroke, fontFamily: pFont, fontSize: pSize, textAlign: pAlign, opacity: pOpacity, selectable: true
        });
        canvas.add(text); canvas.setActiveObject(text); text.enterEditing();
        document.getElementById('select-tool').click(); 
        saveHistory();
    }
    
    if (['rect', 'circle', 'line', 'arrow'].includes(currentTool)) {
        isDrawingShape = true; startX = pointer.x; startY = pointer.y;
        let config = { fill: pBg, stroke: pStroke, strokeWidth: pWidth, opacity: pOpacity, selectable: true, strokeDashArray: getDashArray() };
        
        if (currentTool === 'rect') {
            activeShape = new fabric.Rect({ left: startX, top: startY, ...config, width: 0, height: 0 });
            canvas.add(activeShape);
        } else if (currentTool === 'circle') {
            activeShape = new fabric.Circle({ left: startX, top: startY, ...config, radius: 0 });
            canvas.add(activeShape);
        } else if (currentTool === 'line') {
            activeShape = new fabric.Line([startX, startY, startX, startY], { ...config, fill: null });
            canvas.add(activeShape);
        } else if (currentTool === 'arrow') {
            let line = new fabric.Line([startX, startY, startX, startY], { ...config, fill: null });
            let head = new fabric.Triangle({ width: pWidth * 4, height: pWidth * 4, fill: pStroke, left: startX, top: startY, originX: 'center', originY: 'center', selectable: false });
            activeShape = { line, head, type: 'arrow' };
            canvas.add(line, head);
        }
    }
});

canvas.on('mouse:move', function(opt) {
    const pointer = canvas.getPointer(opt.e);
    
    if (isPanning) {
        let e = opt.e; let vpt = this.viewportTransform;
        vpt[4] += e.clientX - lastPosX; vpt[5] += e.clientY - lastPosY;
        this.requestRenderAll(); lastPosX = e.clientX; lastPosY = e.clientY; return;
    }
    
    if (currentTool === 'eraser' && isErasing) {
        // Push with timestamp for the rapid fade effect
        eraserTrail.push({ x: pointer.x, y: pointer.y, time: Date.now() });
        
        canvas.getObjects().forEach(obj => {
            if (!markedForDeletion.has(obj) && obj.containsPoint(pointer)) { 
                obj.set({ opacity: 0.2 }); 
                markedForDeletion.add(obj);
            }
        });
        canvas.requestRenderAll(); 
    }
    
    if (currentTool === 'laser' && isLaserActive) {
        laserTrail.push({ x: pointer.x, y: pointer.y, time: Date.now() });
    }

    if (isDrawingShape && activeShape) {
        if (currentTool === 'rect') {
            activeShape.set({ width: Math.abs(pointer.x - startX), height: Math.abs(pointer.y - startY) });
            if(pointer.x < startX) activeShape.set({left: pointer.x});
            if(pointer.y < startY) activeShape.set({top: pointer.y});
        } else if (currentTool === 'circle') {
            activeShape.set({ radius: Math.max(Math.abs(pointer.x - startX), Math.abs(pointer.y - startY)) / 2 });
            if(pointer.x < startX) activeShape.set({left: pointer.x});
            if(pointer.y < startY) activeShape.set({top: pointer.y});
        } else if (currentTool === 'line') {
            activeShape.set({ x2: pointer.x, y2: pointer.y });
        } else if (currentTool === 'arrow') {
            activeShape.line.set({ x2: pointer.x, y2: pointer.y });
            activeShape.head.set({ left: pointer.x, top: pointer.y });
            let dx = pointer.x - startX; let dy = pointer.y - startY;
            let angle = Math.atan2(dy, dx) * 180 / Math.PI;
            activeShape.head.set({ angle: angle + 90 }); 
        }
        canvas.renderAll();
    }
});

canvas.on('mouse:up', function() {
    isPanning = false; isLaserActive = false; 
    let didErase = isErasing; isErasing = false;
    
    if (didErase) { 
        if (markedForDeletion.size > 0) {
            markedForDeletion.forEach(obj => canvas.remove(obj));
            markedForDeletion.clear();
            canvas.discardActiveObject();
            saveHistory(); 
        }
        eraserTrail = []; 
        canvas.requestRenderAll();
    }

    if (isDrawingShape && activeShape) {
        if (currentTool === 'arrow') {
            let group = new fabric.Group([activeShape.line, activeShape.head], { selectable: true });
            canvas.remove(activeShape.line, activeShape.head);
            canvas.add(group); group.setCoords();
        } else {
            activeShape.setCoords(); 
        }
        isDrawingShape = false; activeShape = null;
        document.getElementById('select-tool').click();
        saveHistory(); 
    }
});

// --- KEYBOARD SHORTCUTS ---
window.addEventListener('keydown', (e) => {
    if (canvas.getActiveObject() && canvas.getActiveObject().isEditing) return;

    if (e.code === 'Space' && !spacePressed) { spacePressed = true; canvas.isDrawingMode = false; updateCursor(); return; }
    
    if (e.ctrlKey && e.key === 'z') { e.preventDefault(); loadHistory(historyIndex - 1); return; }
    if (e.ctrlKey && e.key === 'y') { e.preventDefault(); loadHistory(historyIndex + 1); return; }
    
    if (e.key === 'Delete' || e.key === 'Backspace') {
        if (canvas.getActiveObject() && !canvas.getActiveObject().isEditing) {
            canvas.getActiveObjects().forEach(obj => canvas.remove(obj));
            canvas.discardActiveObject(); canvas.renderAll(); saveHistory();
        }
        return;
    }

    const key = e.key.toLowerCase();
    if (key === '1' || key === 'v') document.getElementById('select-tool').click();
    if (key === '2' || key === 'r') document.getElementById('rect-tool').click();
    if (key === '3' || key === 'c') document.getElementById('circle-tool').click();
    if (key === '4' || key === 'a') document.getElementById('arrow-tool').click();
    if (key === '5' || key === 'l') document.getElementById('line-tool').click();
    if (key === '6' || key === 'p') document.getElementById('draw-tool').click();
    if (key === '7' || key === 't') document.getElementById('text-tool').click();
    if (key === '8' || key === 'i') document.getElementById('image-loader').click();
    if (key === '9' || key === 'e') document.getElementById('eraser-tool').click();
    if (key === 'k') document.getElementById('laser-tool').click(); 
    if (key === 'h') document.getElementById('pan-tool').click();
});

window.addEventListener('keyup', (e) => {
    if (e.code === 'Space') { spacePressed = false; if(currentTool === 'draw') canvas.isDrawingMode = true; updateCursor(); }
});

// File Import Handler
document.getElementById('image-loader').addEventListener('change', function(e) {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = function(f) {
        fabric.Image.fromURL(f.target.result, function(img) {
            let center = { x: (canvas.width/2)/canvas.getZoom() - canvas.viewportTransform[4]/canvas.getZoom(), y: (canvas.height/2)/canvas.getZoom() - canvas.viewportTransform[5]/canvas.getZoom() };
            if(img.width > 500) img.scaleToWidth(500);
            img.set({ left: center.x - (img.getScaledWidth()/2), top: center.y - (img.getScaledHeight()/2) });
            canvas.add(img); canvas.setActiveObject(img); canvas.renderAll(); saveHistory();
        });
    };
    reader.readAsDataURL(file); this.value = ''; document.getElementById('select-tool').click();
});

// --- PDF IMPORT ---
// Renders page 1 of a PDF to an offscreen <canvas> via pdf.js, turns that into a
// Data URL, then hands it to fabric.Image exactly like the existing image import
// flow. pdf.js does its heavy parsing off the main thread (see the workerSrc
// setup in index.html), and everything here is async, so the UI never freezes.
async function importPdfAsImage(file) {
    if (!window.pdfjsLib) {
        console.error('pdf.js failed to load; cannot import PDF.');
        return;
    }

    const arrayBuffer = await file.arrayBuffer();

    // getDocument() + page.render() are both async and run their parsing work
    // in pdf.js's worker thread, not on the renderer's main thread.
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const page = await pdf.getPage(1); // first page only

    // Render at 2x for a crisp result on high-DPI screens; Fabric will scale
    // the resulting image down to fit the board anyway.
    const renderScale = 2;
    const viewport = page.getViewport({ scale: renderScale });

    const offscreen = document.createElement('canvas');
    offscreen.width = viewport.width;
    offscreen.height = viewport.height;
    const ctx = offscreen.getContext('2d');

    await page.render({ canvasContext: ctx, viewport }).promise;

    const dataUrl = offscreen.toDataURL('image/png');

    fabric.Image.fromURL(dataUrl, function (img) {
        // Same placement/scaling logic as the existing image import, so a
        // dropped-in PDF page behaves identically to any other image:
        // selectable, movable, scalable, and drawn in normal canvas order
        // (so pen/shape/text tools added afterwards sit on top of it).
        let center = {
            x: (canvas.width / 2) / canvas.getZoom() - canvas.viewportTransform[4] / canvas.getZoom(),
            y: (canvas.height / 2) / canvas.getZoom() - canvas.viewportTransform[5] / canvas.getZoom()
        };
        if (img.width > 800) img.scaleToWidth(800);
        img.set({
            left: center.x - (img.getScaledWidth() / 2),
            top: center.y - (img.getScaledHeight() / 2),
            // tag it so other code (export, file-type checks, etc.) can tell
            // a PDF-derived image apart from a plain imported image if needed
            isPdfPage: true
        });
        canvas.add(img);
        canvas.sendToBack(img); // PDFs are usually reference material to draw over
        canvas.setActiveObject(img);
        canvas.renderAll();
        saveHistory();
    });
}

document.getElementById('pdf-loader').addEventListener('change', function (e) {
    const file = e.target.files[0];
    if (!file) return;
    importPdfAsImage(file).catch(err => console.error('PDF import failed:', err));
    this.value = '';
    document.getElementById('select-tool').click();
});

// Sync UI when selecting objects
canvas.on('selection:created', syncUI);
canvas.on('selection:updated', syncUI);
function syncUI(opt) {
    const obj = opt.selected[0]; if(!obj) return;
    document.getElementById('opacity-slider').value = obj.opacity; pOpacity = obj.opacity;
    if(obj.stroke || obj.fill) {
        const colorToFind = obj.type === 'i-text' ? obj.fill : obj.stroke;
        const swatch = document.querySelector(`#stroke-colors [data-val="${colorToFind}"]`);
        if(swatch) {
            document.querySelectorAll('#stroke-colors .swatch').forEach(s => s.classList.remove('selected'));
            swatch.classList.add('selected'); pStroke = colorToFind;
        }
    }
}

// Global safety net to prevent tools from getting stuck if mouse is released outside the window
window.addEventListener('mouseup', (e) => {
    if (isErasing || isPanning || isDrawingShape || isLaserActive) {
        // Manually trigger the canvas mouse:up logic to forcefully end the current action
        canvas.fire('mouse:up', { e: e });
    }
});

// Resets cursor if it glitches when leaving the window
document.addEventListener('mouseleave', () => {
    document.body.style.cursor = 'default';
});