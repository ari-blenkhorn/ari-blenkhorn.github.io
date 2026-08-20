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
aspectToggle.addEventListener('change', render);

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

function resetView() {
	if (!drawCanvas.width) return;

    // Use the clientWidth of the container, which reflects the sidebar's state
    const container = document.querySelector('.editor-container');
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;

    const ribbonH = displayRibbon.classList.contains('collapsed') ? 0 : 40;
    const padding = 40;

    // Calculate available space minus the ribbon height
    const availW = canvas.width - padding;
    const availH = canvas.height - padding - ribbonH;

    viewState.scale = Math.min(availW / drawCanvas.width, availH / drawCanvas.height, 1);
    
	// Center horizontally
    viewState.x = (canvas.width - drawCanvas.width * viewState.scale) / 2;
    // Center vertically in the space BELOW the ribbon
    viewState.y = ribbonH + (availH - drawCanvas.height * viewState.scale) / 2;
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
		let aspectCorrX = 1;
		let aspectCorrY = 1;

		if (aspectToggle.checked) {
			const pph = (parseFloat(document.getElementById('pp4h').value) || 1200) / 4;
			const ppv = (parseFloat(document.getElementById('pp4v').value) || 1200) / 4;
			
			// If stitch gauge is 60 rows x 30sts, pixels are twice as tall as they are wide.
			// To show them physically correct, we scale the X axis.
			if (pph !== ppv) {
				aspectCorrX = ppv / pph; 
			}
		}

		// 2. Apply View Transformation
		// We multiply the user's zoom (viewState.scale) by our aspect correction
		const finalScaleX = viewState.scale * aspectCorrX;
		const finalScaleY = viewState.scale;

		ctx.translate(Math.floor(viewState.x), Math.floor(viewState.y));
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

	// Dynamic step: ensures we don't crowd the screen with numbers
	// this needs to be viewstate not currentscale(c) so that it's reasonable
	// whether onscreen or to PDF
	const step = vs > 2 ? 10 : (vs > 0.5 ? 50 : 200);

	// 3 July: definitely vs, not cs -- don't want them 6x shorter
    const tickSize = 15 / vs; // Longer ticks to cross checkers
    const fontSize = 12 / vs;
    const labelOffset = 20 / vs; // Pushes labels past the checkers

    c.font = `${fontSize}px monospace`;
    c.fillStyle = ctx.strokeStyle = "cyan";
    c.lineWidth = 2 / vs;
	//console.log(`drawRulers:  font size ${fontSize}, lineWidth ${c.lineWidth}`);

    // --- Horizontal Ruler (Bottom - RTL) ---
    c.textAlign = "center";
    for (let dx = step; dx <= w; dx += step) {
        const rx = w - dx;
        c.beginPath();
        c.moveTo(rx, h);
        c.lineTo(rx, h + tickSize);
        c.stroke();
        c.fillText(dx, rx, h + tickSize + fontSize);
    }

    // --- Vertical Ruler (Right - BTT) ---
    c.textAlign = "left";
    for (let dy = step; dy <= h; dy += step) {
        const ry = h - dy;

        c.beginPath();
        // Start tick at the image edge (w)
        c.moveTo(w, ry);
        // Extend tick through the checker (w+1) and into the margin
        c.lineTo(w + tickSize, ry);
        c.stroke();

        // Position label 20px (screen space) to the right of the image edge
        c.fillText(dy, w + labelOffset, ry + (fontSize / 3));
    }
}

function drawPhysicalSizeRulers(c,w,h) {
	if (!drawCanvas.width) return;

	const cs = currentScale(c);
	const vs = viewState.scale;

	// Dynamic step: ensures we don't crowd the screen with numbers
	// value is in inches
	const step = vs > 8 ? .5 :
				vs > 5 ? 1 : (vs > 3 ? 2 : 5);


    // Calculate gauge from your "Pixels per 4 Inches" inputs
    const pph = parseFloat(document.getElementById('pp4h').value) / 4;
    const ppv = parseFloat(document.getElementById('pp4v').value) / 4;

    // Styling for the print ruler
    c.font = `bold ${14 / vs}px sans-serif`;
    c.fillStyle = "#FFD700"; // Gold color to distinguish from pixel ruler
    c.strokeStyle = "#FFD700";
    c.lineWidth = 2 / vs;

	// --- 1. VERTICAL RULER (Left Side - BTT) ---
    c.textAlign = "right";

    // Draw Ticks (Bottom-to-Top orientation)
    // We loop through inches (increments of 'step')
    for (let inch = step; inch * ppv <= h; inch += step) {
        const rawY = (h - 1) - (inch * ppv);
        const isMajor = inch % 1 === 0;
        const tickWidth = (isMajor ? 25 : 12) / vs;

        c.beginPath();
        c.moveTo(0, rawY);
        c.lineTo(-tickWidth, rawY);
        c.stroke();

        if (isMajor && inch > 0) {
            c.fillText(`${inch}"`, -tickWidth - (5 / vs), rawY + (5 / vs));
        }
    }

    // --- 2. HORIZONTAL RULER (Top Side - RTL) ---
    c.textAlign = "center";
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
            c.fillText(`${inch}"`, rawX, -tickHeight - (5 / vs));
        }
    }
}

// Add listener to re-render when toggled
physicalRulersToggle.addEventListener('change', render);

function drawRowCheckers(c,w,h) {
	if (!drawCanvas.width) return;
    
    const squareWidth = 1; // Keep the row markers square, i.e. one pixel in image-space
    
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

function drawBrushPreview(c) {
    // Only draw if mouse is over image and not currently panning
    if (mouseImagePos.x === null || isPanning) return;

    const size = parseInt(brushSlider.value);
    const radius = Math.floor(size / 2);
    
    // Calculate the top-left corner of the brush area
    const startX = mouseImagePos.x - radius;
    const startY = mouseImagePos.y - radius;

	const pph = (parseFloat(document.getElementById('pp4h').value) || 1200) / 4;
    const ppv = (parseFloat(document.getElementById('pp4v').value) || 1200) / 4;
    
    // Determine the visual aspect correction used in render()
    const isPhysical = document.getElementById('usePhysicalAspect').checked;
    const aspectCorrX = isPhysical ? (ppv / pph) : 1;

    c.save();
	
	// Apply the horizontal stretch to the context before drawing the rect
    // This makes the 5x5 square look like a 5x5 physical rectangle
    c.scale(aspectCorrX, 1);

    // CRITICAL: We must divide the X position by the scale factor 
    // because the coordinate system itself is now stretched horizontally
    const drawX = startX / aspectCorrX;

    c.setLineDash([2 / viewState.scale, 2 / viewState.scale]);
    c.strokeStyle = "rgba(255, 255, 0, 0.8)";
    c.lineWidth = 1 / viewState.scale;
    
    // Draw the rectangle (it will be visually stretched by the scale above)
    c.strokeRect(drawX, startY, size, size);
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
