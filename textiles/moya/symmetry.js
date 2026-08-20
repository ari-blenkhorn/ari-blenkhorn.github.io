
// Are we in a drawing mode that produces mosaic-in-the-round charts
// for a single sector that will be repeated around the work?
function usingRotationSectors()
{
    const symMode = symSelect.value;
    if ( (symMode == '4xITR') || (symMode == '8xITR')) return true;
    if ( (symMode == '4xMagic') || (symMode == '8xMagic')) return true;
    else return false;
}

function usingMirroring()
{
    const symMode = symSelect.value;
    if ( (symMode == 'vertical') || (symMode == 'horizontal'))  return true;
    else return false;
}


function pixelInActiveDrawingArea(tx, ty, w, h)
{
    const symMode = symSelect.value;
    if (! usingRotationSectors())
        return true;

    // Center coords
    const cx = w / 2;
    const cy = w / 2; // Using Width for both to ensure square logic

    // Relative coords
    const rx = tx - cx;
    const ry = ty - cy;

    if ((symMode === "4xMagic") || (symMode === "4xITR")) {
        // Only allow drawing if inside the TOP triangle
        // ry < 0 == above center point
        // rx <= abs(ry) == within 45-degree lines

        if  (ry < 0 && Math.abs(rx) <= Math.abs(ry))
            return true;
    }
    else if ((symMode === "8xMagic") || (symMode === "8xITR")) {
        if (ry < 0 && rx > 0 && (rx <= Math.abs(ry)))
            return true;
    }

    return false;
}

// For 4-way symmetric patterns

function drawSymmetryMask(c, w, h) {
		// Center coords
	const cx = w / 2;
	const cy = h / 2;

    c.save();
    c.fillStyle = "rgba(0, 0, 0, 0.6)"; // Dark fade

    const symMode = symSelect.value;

	if ( usingRotationSectors() )
	{
		// Bottom Triangle
		c.beginPath();
		c.moveTo(0, h); c.lineTo(w, h); c.lineTo(cx, cy);
		c.fill();

		// Left Triangle
		c.beginPath();
		c.moveTo(0, 0); c.lineTo(0, h); c.lineTo(cx, cy);
		c.fill();

		// Right Triangle
		c.beginPath();
		c.moveTo(w, 0); c.lineTo(w, h); c.lineTo(cx, cy);
		c.fill();

		//  Octant Mode only: Also mask the Top-Left half of the top wedge
		if ( (symMode === '8xITR') || (symMode === '8xITRMagic') ) {
            c.beginPath();
            c.moveTo(0, 0);   // Top-Left corner
            c.lineTo(cx, 0);  // Top-Center edge midpoint
            c.lineTo(cx, cy); // Center point
            c.fill();
        }
	}

    c.restore();
}

symSelect.addEventListener('change', () => {
    // 1. If 4xITR or 8xITR Symmetry is turned on, ensure the user knows it works best on a Square
	const symMode = symSelect.value;
    if ( ! usingRotationSectors()) return;
	
	else if (drawCanvas.width !== drawCanvas.height) {
        console.warn("In-the-round symmetry mode active on a non-square canvas. Results may be offset.");
    }

    // 2. Immediately redraw the canvas to show/hide the dark mask
    render();
});

function drawSymmetryCenter(c, w, h) {
    if ( ! usingRotationSectors() ) return;

    const centerX = w / 2;
    const centerY = h / 2;
    const dotSize = 4 / viewState.scale; // Size in screen pixels

    c.save();
    c.beginPath();
    c.arc(centerX, centerY, dotSize, 0, Math.PI * 2);

    // Bright yellow fill with a dark stroke for visibility on all backgrounds
    c.fillStyle = "#FFFF00";
    c.strokeStyle = "#000000";
    c.lineWidth = 1 / viewState.scale;

    c.fill();
    c.stroke();
    c.restore();
}