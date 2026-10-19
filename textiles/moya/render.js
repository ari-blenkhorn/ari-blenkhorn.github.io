/** RENDERING & RULERS **/

resetBtn.addEventListener('click', () => { resetView(); render(); });
gridToggle.addEventListener('click', () => { render(); });
subGridToggle.addEventListener('click', () => { render(); });
firstRowAToggle.addEventListener('change', render);
validationErrorToggle.addEventListener('change', render);

const viewMode = document.getElementById('viewMode');
const traceOpacity = document.getElementById('traceOpacity');
const traceOpacityVal = document.getElementById('traceOpacityVal');
const traceControl = document.getElementById('traceControl');

const swapPaletteBtn = document.getElementById('swapPaletteBtn');
const colorAInput = document.getElementById('colorAInput');
const colorBInput = document.getElementById('colorBInput');
const resetPaletteBtn = document.getElementById('resetPaletteBtn');
const aspectToggle = document.getElementById('usePhysicalAspect');

// display pixels as squares or using stitch gauge?
// Keep the zoom and center, zooming out only if the stretched chart won't fit.
// The zoom from before any such zoom-out is remembered, so toggling back
// zooms in again instead of leaving the chart smaller.
let aspectToggleZoom = null; // { base, result } from the last toggle

aspectToggle.addEventListener('change', () => {
	const oldAspectX = aspectToggle.checked ? 1 : gaugeAspectX();
	const box = chartScreenBox(oldAspectX);
	const { availW, availH } = fitArea();
	const ax = aspectCorrectionX();

	// Reuse the remembered zoom unless the user has zoomed since the last toggle
	const base = (aspectToggleZoom && viewState.scale === aspectToggleZoom.result)
		? aspectToggleZoom.base : viewState.scale;
	const fitScale = Math.min(availW / (drawCanvas.width * ax), availH / drawCanvas.height);
	viewState.scale = clampScale(Math.min(base, fitScale));
	aspectToggleZoom = { base, result: viewState.scale };
	viewState.x = box.cx - drawCanvas.width * ax * viewState.scale / 2;
	viewState.y = box.cy - drawCanvas.height * viewState.scale / 2;
	render();
});

// Toggle opacity slider visibility
viewMode.addEventListener('change', () => {
    traceControl.style.display = (viewMode.value === 'trace') ? 'inline-block' : 'none';
    render();
});

traceOpacity.addEventListener('input', () => {
    traceOpacityVal.innerText = traceOpacity.value;
    render();
});

// Re-render when user picks new colors for palette
colorAInput.addEventListener('input', render);
colorBInput.addEventListener('input', render);

resetPaletteBtn.addEventListener('click', () => {
    // 1. Restore standard Hex values
    colorBInput.value = "#000000";
    colorAInput.value = "#ffffff";
    
    // 2. Trigger the visual refresh
    // Since render() calls updateDisplayBuffer(), the colors will update immediately
    render();
    
    console.log("Palette reset to standard Black & White.");
});

swapPaletteBtn.addEventListener('click', () => {
    // Standard JS variable swap using destructuring
    [colorAInput.value, colorBInput.value] = [colorBInput.value, colorAInput.value];
    
    // Manually trigger the render to update the tinted display buffer
    render();
    
    console.log("Palette colors swapped.");
});

// TODO/CBB - this is redundant since creating Color3 class
function hexToRgb(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return { r, g, b };
}

// TODO/CBB for performance, can run this only when a palette color changes 
// or a pixel is edited, rather than every frame.
function updateDisplayBuffer() {
    if (!drawCanvas.width) return;

    displayCanvas.width = drawCanvas.width;
    displayCanvas.height = drawCanvas.height;

    // Get the black/white data from drawing layer
    const id = drawCtx.getImageData(0, 0, drawCanvas.width, drawCanvas.height);
    const d = id.data;
    
	// What colors do black/white map to for display?
    const col_A = hexToRgb(colorAInput.value);
    const col_B = hexToRgb(colorBInput.value);

    // Loop through every pixel to remap colors
    for (let i = 0; i < d.length; i += 4) {
        // Since the image is thresholded, we only need to check one channel (e.g., Red)
        const isWhite = d[i] > 127;
        const target = isWhite ? col_A : col_B;

        d[i]     = target.r;
        d[i + 1] = target.g;
        d[i + 2] = target.b;
        // Keep original alpha
    }

    displayCtx.putImageData(id, 0, 0);
}

// Zoom limits, shared with zoomFromCenter
const MIN_SCALE = 0.01;
const MAX_SCALE = 100;
// Fraction of the display area the chart fills when the view is reset
const FIT_FRACTION = 0.9;

function clampScale(s) {
	return Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));
}

// Horizontal stretch applied when showing non-square stitches
// (1 when the toggle is off or the gauge is square)
function aspectCorrectionX() {
	return aspectToggle.checked ? gaugeAspectX() : 1;
}

// Stitch aspect from the gauge, whether or not it's being displayed
function gaugeAspectX() {
	const { pph, ppv } = appliedGauge();
	return ppv / pph;
}

// Gauge (stitches and rows per inch) currently applied to the chart: the
// reference recorded when it was created, loaded, or regauged. Values typed
// into the gauge fields don't affect the display until they're applied.
function appliedGauge() {
	const typed = (input) => (parseFloat(input.value) || 1200) / 4;
	return {
		pph: parseFloat(pp4hInput.dataset.oldGauge) || typed(pp4hInput),
		ppv: parseFloat(pp4vInput.dataset.oldGauge) || typed(pp4vInput),
	};
}

// Horizontal stretch of a drawing context relative to its vertical scale
// (non-square stitches), read from the context so PDF export works too
function contextAspectX(c) {
	const m = c.getTransform();
	return m.d ? m.a / m.d : 1;
}

// Draw ruler text at a real font size in screen space, anchored at chart
// coordinates (x, y). Text drawn at a tiny font size inside the heavily scaled
// chart transform gets glyphs clipped depending on where it lands, which shows
// up while panning; drawing it unscaled also keeps it from being stretched by
// non-square stitches. `font` is a CSS font in screen pixels, e.g. "12px monospace".
function fillTextScreen(c, text, x, y, font) {
	const m = c.getTransform();
	// Device pixels per screen pixel: 1 on screen, higher for PDF export
	const k = m.d / viewState.scale;
	const p = new DOMPoint(x, y).matrixTransform(m);
	c.save();
	c.setTransform(k, 0, 0, k, 0, 0);
	c.font = font;
	c.fillText(text, Math.round(p.x) / k, Math.round(p.y) / k);
	c.restore();
}

// Width (in stitch units) of the square row-color markers right of the chart
function rowMarkerWidth(c) {
	return 1 / contextAspectX(c);
}

// Ruler label spacing, from the on-screen size of one stitch
function rulerStep(pxPerStitch) {
	return pxPerStitch > 2 ? 10 : (pxPerStitch > 0.5 ? 50 : 200);
}

// The main canvas's pixel buffer is sized in device pixels (CSS size times
// devicePixelRatio), so Chrome never resamples it when the browser is zoomed
// or the display is scaled; resampling drops rows of pixels and clips text.
// viewState and all layout below are in CSS pixels: canvas.clientWidth/Height.
function canvasDPR() {
	const cssW = canvas.getBoundingClientRect().width;  // unrounded, unlike clientWidth
	return cssW ? canvas.width / cssW : 1;
}

// Exact size of the canvas in device pixels, as Chrome lays it out. With a
// fractional devicePixelRatio (e.g. 0.9 at 90% zoom), CSS size x dpr is not a
// whole number, and rounding it ourselves still leaves a tiny stretch that
// duplicates or drops a column of pixels somewhere. The observer reports the
// size Chrome actually uses, so the buffer maps 1:1 to the screen.
let canvasDeviceSize = null;
if (window.ResizeObserver) {
	const ro = new ResizeObserver(entries => {
		const box = entries[0].devicePixelContentBoxSize && entries[0].devicePixelContentBoxSize[0];
		if (!box) return;
		canvasDeviceSize = { w: box.inlineSize, h: box.blockSize };
		// Keep the buffer matched (e.g. after a browser zoom) without moving the view
		if (canvas.width !== canvasDeviceSize.w || canvas.height !== canvasDeviceSize.h) {
			canvas.width = canvasDeviceSize.w;
			canvas.height = canvasDeviceSize.h;
			// Before load, there's no chart yet (just the placeholder canvas)
			if (document.readyState === 'complete') render();
		}
	});
	try { ro.observe(canvas, { box: 'device-pixel-content-box' }); }
	catch (e) { ro.disconnect(); }  // browser doesn't support that box; fall back to rounding
}

function sizeCanvasBuffer() {
	if (canvasDeviceSize) {
		canvas.width = canvasDeviceSize.w;
		canvas.height = canvasDeviceSize.h;
	} else {
		const dpr = window.devicePixelRatio || 1;
		const rect = canvas.getBoundingClientRect();
		canvas.width = Math.round(rect.width * dpr);
		canvas.height = Math.round(rect.height * dpr);
	}
}

// Space the chart may fill: most of the display area below the ribbon,
// always leaving room for the rulers
function fitArea() {
    const ribbonH = displayRibbon.classList.contains('collapsed') ? 0 : 40;
    const viewW = canvas.clientWidth;
    const areaH = canvas.clientHeight - ribbonH;
    return {
        ribbonH, areaH,
        availW: Math.min(viewW * FIT_FRACTION, viewW - 80),
        availH: Math.min(areaH * FIT_FRACTION, areaH - 80),
    };
}

function resetView() {
	if (!drawCanvas.width) return;

    // The canvas fills the editor container (CSS 100%), which reflects the
    // sidebar's state; size its pixel buffer to match in device pixels
    sizeCanvasBuffer();

    const { ribbonH, areaH, availW, availH } = fitArea();

    const ax = aspectCorrectionX();
    viewState.scale = clampScale(Math.min(availW / (drawCanvas.width * ax), availH / drawCanvas.height));

	// Center horizontally
    viewState.x = (canvas.clientWidth - drawCanvas.width * ax * viewState.scale) / 2;
    // Center vertically in the space BELOW the ribbon
    viewState.y = ribbonH + (areaH - drawCanvas.height * viewState.scale) / 2;
}

// On-screen box the chart currently occupies. Capture this before
// changing the chart's resolution, then pass it to keepApparentSize().
function chartScreenBox(ax = aspectCorrectionX()) {
	const w = drawCanvas.width * ax * viewState.scale;
	const h = drawCanvas.height * viewState.scale;
	return { w, h, cx: viewState.x + w / 2, cy: viewState.y + h / 2 };
}

// After a resolution change, zoom so the chart keeps the same
// on-screen size and center it had before (box from chartScreenBox).
function keepApparentSize(box) {
	if (!drawCanvas.width || !box.w || !box.h) { resetView(); return; }

	const ax = aspectCorrectionX();
	viewState.scale = clampScale(Math.min(box.w / (drawCanvas.width * ax), box.h / drawCanvas.height));
	viewState.x = box.cx - drawCanvas.width * ax * viewState.scale / 2;
	viewState.y = box.cy - drawCanvas.height * viewState.scale / 2;
}


function render() {
    if (!drawCanvas.width) return;
	const w = drawCanvas.width;
	const h = drawCanvas.height;
	
	// Always update the tinted buffer before drawing
    updateDisplayBuffer(drawCanvas, displayCanvas);

	try {
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		
		// --- KEY ADDITION FOR SHARPNESS ---
		ctx.imageSmoothingEnabled = false;
		// For older browser compatibility
		ctx.webkitImageSmoothingEnabled = false;
		ctx.mozImageSmoothingEnabled = false;
		// ----------------------------------

		// 1. Calculate the Aspect Ratio Correction
		// If stitch gauge is 60 rows x 30sts, pixels are twice as tall as they are wide.
		// To show them physically correct, we scale the X axis.
		const aspectCorrX = aspectCorrectionX();

		// 2. Apply View Transformation
		// We multiply the user's zoom (viewState.scale) by our aspect correction
		const finalScaleX = viewState.scale * aspectCorrX;
		const finalScaleY = viewState.scale;

		// Work in CSS pixels on a device-pixel buffer (see canvasDPR),
		// snapping the chart origin to a whole device pixel
		const dpr = canvasDPR();
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.translate(Math.round(viewState.x * dpr) / dpr, Math.round(viewState.y * dpr) / dpr);
		ctx.scale(finalScaleX, finalScaleY);

    
		const mode = viewMode.value;

		// 3. Draw the layers
		// --- LAYER 1: Background ---
		if ((mode === 'original' || mode === 'trace') && bgCanvas.width) {
			// Draw the pristine original image
			ctx.globalAlpha = 1.0;
			ctx.drawImage(bgCanvas, 0, 0);
		}


		// --- LAYER 2: Working Image ---
		if (mode === 'palette' || mode === 'trace') {
			if (mode === 'trace') {
				// In Trace Mode, the working image (palette) sits on top of the original
				// with a user-defined opacity.
				ctx.globalAlpha = parseInt(traceOpacity.value) / 100;
			} else {
				ctx.globalAlpha = 1.0;
			}
			
			// Use displayCanvas (the tinted one)
			ctx.drawImage(displayCanvas, 0, 0);
		}
	} catch (err) {
		alert(`Render error.: ${err.message}`);
	}
	

	// --- LAYER 3: Draw the Overlays: row-color markers, grid, rulers, etc.
	// Reset alpha for UI elements
    ctx.globalAlpha = 1.0;

	// draw the mask first, so everything else is on top of it and not dimmed by mask
	drawSymmetryMask(ctx, w, h);

 	drawRowCheckers(ctx,w,h);
	if (gridToggle.checked) drawGrid(ctx, w, h);
	drawRulers(ctx, w, h);
	if (physicalRulersToggle.checked) drawPhysicalSizeRulers(ctx, w, h);
	drawColumnSeparator(ctx, w, h);
	drawValidationErrors(ctx, w, h);
	drawChartMarkings(ctx, w, h);

	// onscreen only, for drawing assistance
    drawSymmetryCenter(ctx, w, h);
	drawBrushPreview(ctx);

	// ---  UI Sync (Always call this!) ---
	updateStatusWindow();
}

function currentScale(ctx) {
    // Get the current canvas transformation matrix,
    // so we scale correctly both onscreen and in PDFs.
    const matrix = ctx.getTransform();
    const cs = matrix.a // represents horizontal scaling
	return cs;
}

function drawGrid(c,w,h) {
	if (!drawCanvas.width) return;

	// Dynamic step: ensures we don't crowd the screen with numbers
	const cs = currentScale(c);
	const vs = viewState.scale;

	const step = vs > 2 ? 10 : (vs > 0.5 ? 50 : 200);

    if (subGridToggle.checked) {
        c.beginPath(); c.strokeStyle = "rgba(127,127,255,0.8)"; c.lineWidth = 1/vs;
        for(let x=0; x<=w; x++) { c.moveTo(x,0); c.lineTo(x,h); }
        for(let y=0; y<=h; y++) { c.moveTo(0,y); c.lineTo(w,y); }
        c.stroke();
    }
    if (gridToggle.checked) {
        c.beginPath(); c.strokeStyle = "rgba(0,255,255,0.4)"; c.lineWidth = 2/vs;
        for(let x=step; x<=w; x+=step) { c.moveTo(w-x,0); c.lineTo(w-x,h); }
        for(let y=step; y<=h; y+=step) { c.moveTo(0,h-y); c.lineTo(w,h-y); }
        c.stroke();
    }
}

// Add listener for the new Pixel Rulers toggle
const pixelRulerToggle = document.getElementById('showPixelRulers');
pixelRulerToggle.addEventListener('change', render);


function drawRulers(c,w,h) {
	if (!drawCanvas.width) return;
	if (!pixelRulerToggle.checked) return; 

	const cs = currentScale(c);
	const vs = viewState.scale;
	//console.log(`drawRulers: cs ${cs}, vs ${vs}`)

	// Non-square stitches stretch the x axis; undo that for horizontal
	// lengths and text so they look the same as on the other ruler
	const ax = contextAspectX(c);

	// Dynamic step: ensures we don't crowd the screen with numbers
	// this needs to be viewstate not currentscale(c) so that it's reasonable
	// whether onscreen or to PDF. Columns are stretched by ax.
	const stepX = rulerStep(vs * ax);
	const stepY = rulerStep(vs);

	// 3 July: definitely vs, not cs -- don't want them 6x shorter
    const tickSize = 15 / vs; // Longer ticks to cross checkers
    const font = "12px monospace"; // screen pixels, see fillTextScreen

    c.fillStyle = c.strokeStyle = "cyan";
    c.lineWidth = 2 / vs;

    // --- Horizontal Ruler (Bottom - RTL) ---
    c.textAlign = "center";
    // Hang labels from their top edge, a small gap below the tick, so the
    // tick never runs into the digits
    c.textBaseline = "top";
    for (let dx = stepX; dx <= w; dx += stepX) {
        const rx = w - dx;
        c.beginPath();
        c.moveTo(rx, h);
        c.lineTo(rx, h + tickSize);
        c.stroke();
        fillTextScreen(c, dx, rx, h + tickSize + (3 / vs), font);
    }

    // --- Vertical Ruler (Right - BTT) ---
    // Ticks and labels start past the row-color markers, which are one
    // row tall and so get wider as you zoom in
    const markerEnd = w + rowMarkerWidth(c);
    const tickEnd = markerEnd + (8 / vs) / ax;
    const labelX = tickEnd + (4 / vs) / ax;
    c.textAlign = "left";
    c.textBaseline = "middle";
    for (let dy = stepY; dy <= h; dy += stepY) {
        const ry = h - dy;

        c.beginPath();
        // Start tick at the image edge (w)
        c.moveTo(w, ry);
        // Extend tick through the markers and into the margin
        c.lineTo(tickEnd, ry);
        c.stroke();

        // Position label just past the tick, centered on it
        fillTextScreen(c, dy, labelX, ry, font);
    }
    c.textBaseline = "alphabetic";
}

function drawPhysicalSizeRulers(c,w,h) {
	if (!drawCanvas.width) return;

	const cs = currentScale(c);
	const vs = viewState.scale;

	// Dynamic step: ensures we don't crowd the screen with numbers
	// value is in inches
	const step = vs > 8 ? .5 :
				vs > 5 ? 1 : (vs > 3 ? 2 : 5);


    // Gauge applied to the chart (not values typed but not yet applied)
    const { pph, ppv } = appliedGauge();
    // Undo the non-square-stitch stretch for horizontal lengths and text
    const ax = contextAspectX(c);

    // Styling for the print ruler
    const font = "bold 14px sans-serif"; // screen pixels, see fillTextScreen
    c.fillStyle = "#FFD700"; // Gold color to distinguish from pixel ruler
    c.strokeStyle = "#FFD700";
    c.lineWidth = 2 / vs;

	// --- 1. VERTICAL RULER (Left Side - BTT) ---
    c.textAlign = "right";
    c.textBaseline = "middle";

    // Draw Ticks (Bottom-to-Top orientation)
    // We loop through inches (increments of 'step')
    for (let inch = step; inch * ppv <= h; inch += step) {
        const rawY = (h - 1) - (inch * ppv);
        const isMajor = inch % 1 === 0;
        const tickWidth = (isMajor ? 25 : 12) / vs / ax;

        c.beginPath();
        c.moveTo(0, rawY);
        c.lineTo(-tickWidth, rawY);
        c.stroke();

        if (isMajor && inch > 0) {
            fillTextScreen(c, `${inch}"`, -tickWidth - (5 / vs / ax), rawY, font);
        }
    }

    // --- 2. HORIZONTAL RULER (Top Side - RTL) ---
    c.textAlign = "center";
    c.textBaseline = "bottom";
    for (let inch = step; inch * pph <= w; inch += step) {
        // Since the image is RTL, 0 inches is at the far right (w)
        const rawX = w - (inch * pph);
        const isMajor = inch % 1 === 0;
        const tickHeight = (isMajor ? 25 : 12) / vs;

        c.beginPath();
        c.moveTo(rawX, 0);
        // Draw ticks upward from the top edge (negative Y)
        c.lineTo(rawX, -tickHeight);
        c.stroke();

        if (isMajor && inch > 0) {
            // Position label above the tick
            fillTextScreen(c, `${inch}"`, rawX, -tickHeight - (3 / vs), font);
        }
    }
    c.textBaseline = "alphabetic";
}

// Add listener to re-render when toggled
physicalRulersToggle.addEventListener('change', render);

function drawRowCheckers(c,w,h) {
	if (!drawCanvas.width) return;
    
    // Keep the row markers square: as wide on screen as one row is tall,
    // even when non-square stitches stretch the x axis
    const squareWidth = rowMarkerWidth(c);
    
    // Determine the starting color based on the toggle
    // If Bottom is White (true), then even/odd logic flips
    const bottomIsWhite = firstRowAToggle.checked;

    for (let row = 0; row < h; row++) {
        // Our system is Bottom-to-Top (BTT). 
        // Row 0 (Bottom) index in raw Y is (h - 1)
        const rawY = (h - 1) - row;
        
        // Alternating logic: 
        // If bottomIsWhite is true, even rows (0, 2, 4...) are white.
        const isWhite = (row % 2 === 0) ? bottomIsWhite : !bottomIsWhite;
        
        c.fillStyle = isWhite ? "#FFFFFF" : "#000000";
        
        // Draw the square on the right side of the image
        // x: width of image, y: raw row coordinate, w: fixed visual width, h: 1 pixel
        c.fillRect(w, rawY, squareWidth, 1);
    }
}

function drawValidationErrors(c,w,h) {
	if (!drawCanvas.width) return;

	// CHECK 1: Ensure stats exist and toggles is on
    if (!validationStats || !validationErrorToggle.checked) return;

    // CHECK 2: Ensure array exists
    if (!validationOutput) return;

	const cs = currentScale(c);
	const vs = viewState.scale;

    validationOutput.forEach(err => {
        if (err.type === 'invalid') {

            let drawMe = true;
            if (usingRotationSectors())
            {
                // pixel must be in the active region
                if (! pixelInActiveDrawingArea(err.x, err.y, w, h))
                    drawMe = false;
            }

            if (drawMe)
            {
                // Outline Invalid Pixels in Red
                c.strokeStyle = "red";
                c.lineWidth = 1 / vs;
                c.strokeRect(err.x, err.y, 1, 1);
            }
        } 
    });
}

/*
// Toggle markings-direction radio buttons visibility
chartMarkingsToggle.addEventListener('change', () => {
    markingsDirectionControl.style.display = (chartMarkingsToggle.checked) ? 'inline-block' : 'none';
    render();
});
*/
const markingsMode = document.getElementById('markingsMode');


function drawChartMarkings(c,w,h) {
	if (!drawCanvas.width) return;

    const imgWidth = drawCanvas.width;
    const imageData = drawCtx.getImageData(0, 0, imgWidth, drawCanvas.height).data;

    const mm = markingsMode.value;

    //console.log( `Chart marking mode: ${mm}`);

    // CHECK 1: Ensure stats exist and toggle is on
    if (!validationStats || (mm === "none")) return;

    // CHECK 2: Ensure array exists
    if (!validationOutput) return;

 
    validationOutput.forEach(err => {
        let drawMe = false;

            let xx = err.x;
            let yy = err.y

        // Is this a stitch that might have a marking?
        if (mm === 'down' && err.type === 'top-anchor') {
            //console.log(`Down: mark ${xx} ${yy}`);
            drawMe = true;
        }

        // Does it indicate another that does?
        else if (mm ==='up' && err.type === 'top-anchor')
        {
            // If this stitch is a top anchor, the stitch 2 rows down is a bottom anchor.
            //console.log(`Up: mark ${xx} ${yy}+2 because ${xx} ${yy} is top anchor`);
            drawMe = true;
            yy = yy + 2;
            
        }

        // if we have an anchor, is it in the part of the image that's valid to draw?
        if (drawMe) {
            if (usingRotationSectors())
            {
                // pixel must be in the active region
                if (! pixelInActiveDrawingArea(xx, yy, w, h))
                    drawMe = false;
            }

            if (drawMe)
                // Draw an "X" for anchor stitches
                drawPixelX(c, xx, yy, imageData, imgWidth);
        }
    });
}

function drawPixelX(c,x,y, imageData, imgWidth) {
    // Determine a contrasting color by checking the underlying pixel
	// (in the image we're currently drawing into)

    // 6/21:
    // Calculate the array index for the specific (x, y) pixel
    const index = (Math.floor(y) * imgWidth + Math.floor(x)) * 4;

    // Default to white if out of bounds, otherwise sample cached data
    let brightness = 0;
    if (index >= 0 && index < imageData.length) {
        const r = imageData[index];
        const g = imageData[index + 1];
        const b = imageData[index + 2];
        brightness = (r * 0.299 + g * 0.587 + b * 0.114);
    }

    c.strokeStyle = brightness > 128 ? "black" : "white"; // Contrast against pixel
    
    const cs = currentScale(c);
	const vs = viewState.scale;

    //c.lineWidth = 2.0 / viewState.scale; // Slightly thicker for the X
    c.lineWidth = 1.5 / vs;

	//console.log(`drawing marks:  viewState.scale ${viewState.scale}, currentScale ${cs}`);
    
    c.beginPath();
        // --- CRITICAL: Use clean fractional offsets so lines align with pixel grids ---
    // Top-left to bottom-right
    c.moveTo(x + 0.25, y + 0.25);
    c.lineTo(x + 0.75, y + 0.75);
    // Top-right to bottom-left
    c.moveTo(x + 0.75, y + 0.25);
    c.lineTo(x + 0.25, y + 0.75);
    c.stroke();
}

// To avoid confusion,
// add a visual separator between the row-color markers and the stitch grid
function drawColumnSeparator(c,w,h) {
	if (!drawCanvas.width) return;

	const vs = viewState.scale;

    // Use a color that stands out from both black/white and your cyan rulers
    c.strokeStyle = "#FF33FF"; // Neon Magenta/Pink
    c.lineWidth = 3 / vs; // Maintain a 3-pixel screen width regardless of zoom

    c.beginPath();
    // Draw exactly at the boundary between image (w) and checkers (w + squareWidth)
    c.moveTo(w, 0);
    c.lineTo(w, h);
    c.stroke();
}

// Brush footprint: offsets lo..hi (size stitches) from the center stitch.
// Odd sizes are centered; even sizes extend one more stitch up/left.
function brushSpan() {
    const size = Math.max(1, parseInt(brushSlider.value) || 1);
    const lo = -Math.floor(size / 2);
    return { size, lo, hi: lo + size - 1 };
}

function drawBrushPreview(c) {
    // Only draw if mouse is over image and not currently panning
    if (mouseImagePos.x === null || isPanning) return;

    // Only over a stitch that can be drawn on: inside the chart and, with
    // symmetry, inside the active drawing region
    const w = drawCanvas.width, h = drawCanvas.height;
    const mx = mouseImagePos.x, my = mouseImagePos.y;
    if (mx < 0 || mx >= w || my < 0 || my >= h) return;
    if (!pixelInActiveDrawingArea(mx, my, w, h)) return;

    // Outline the stitches paintBrushAt() will paint, trimmed to the chart
    const { lo, hi } = brushSpan();
    const x0 = Math.max(0, mx + lo), x1 = Math.min(w, mx + hi + 1);
    const y0 = Math.max(0, my + lo), y1 = Math.min(h, my + hi + 1);

    // The context already includes the non-square-stitch stretch (see
    // render), so the outline matches the stitches without extra scaling
    // Black line under white dashes, so it shows on any background color
    const px = 1 / viewState.scale;  // one screen pixel
    c.save();
    c.lineWidth = 2 * px;
    c.strokeStyle = "#000000";
    c.strokeRect(x0, y0, x1 - x0, y1 - y0);
    c.setLineDash([4 * px, 4 * px]);
    c.strokeStyle = "#ffffff";
    c.strokeRect(x0, y0, x1 - x0, y1 - y0);
    c.restore();

    // Reset dash for other drawing functions
    c.setLineDash([]);
}


const clearTraceToABtn = document.getElementById('clearTraceToABtn');
const clearTraceToBBtn = document.getElementById('clearTraceToBBtn');

/** Clear only the drawing (ink) layer, which uses A=white, B=black **/

clearTraceToABtn.addEventListener('click', () => {

	clearTraceToColor("#ffffff");
});

clearTraceToBBtn.addEventListener('click', () => {

	clearTraceToColor("#000000");
});

function clearTraceToColor(color)
{
    if (!drawCanvas.width) return;

    let okToProceed = (!isDirty || 
        confirm("This will erase all your current edits/thresholding and give you a blank layer to draw on. The original background will remain. Continue?")) 

    if (okToProceed)
	{
	 // 1. Fill the working canvas with specified color
        drawCtx.fillStyle = color;
        drawCtx.fillRect(0, 0, drawCanvas.width, drawCanvas.height);

        // 2. Reset validation state since the image is now "clean"
        validationOutput = [];
        validationStats = null;
        isStatsDirty = false;
        activePixel = null;

        // 3. Mark as dirty so the user can 'Revert' if they change their mind
        setDirty(true);

        // 4. Update the visual display
        render();
	
	    console.log("Working layer cleared to ", color, ". Background preserved.");
	}
}


const displayRibbon = document.getElementById('displayRibbon');
const hideRibbonBtn = document.getElementById('hideRibbonBtn');
const showRibbonBtn = document.getElementById('showRibbonBtn');

function toggleRibbon(show) {
    if (show) {
        displayRibbon.classList.remove('collapsed');
        showRibbonBtn.classList.add('hidden');
        displayRibbon.style.pointerEvents = 'auto';
    } else {
        displayRibbon.classList.add('collapsed');
        showRibbonBtn.classList.remove('hidden');
        displayRibbon.style.pointerEvents = 'none';
    }
    // Recalculate centering since the available "clear" height changed
    resetView();
    render();
}

hideRibbonBtn.addEventListener('click', () => toggleRibbon(false));
showRibbonBtn.addEventListener('click', () => toggleRibbon(true));
