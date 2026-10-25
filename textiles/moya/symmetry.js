
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

    // Same geometry as drawSymmetryMask: the center is (w/2, h/2) and the
    // wedge edges run from the top corners to it. Test the stitch's center
    // (not its top-left corner) so stitches that are mostly in the shaded
    // area near the center point count as inactive.
    const cx = w / 2;
    const cy = h / 2;

    // Stitch center, relative to the chart center, scaled so the
    // diagonals to the corners are at 45 degrees (works for non-square charts)
    const nx = (tx + 0.5 - cx) / cx;
    const ny = (ty + 0.5 - cy) / cy;

    if ((symMode === "4xMagic") || (symMode === "4xITR")) {
        // Only allow drawing inside the TOP triangle:
        // above the center (ny < 0) and between the diagonals (|nx| <= -ny)
        if (ny < 0 && Math.abs(nx) <= -ny)
            return true;
    }
    else if ((symMode === "8xMagic") || (symMode === "8xITR")) {
        // Right half of the top triangle
        if (ny < 0 && nx > 0 && nx <= -ny)
            return true;
    }

    return false;
}

// For 4-way symmetric patterns

function drawSymmetryMask(c, w, h) {
	if (!usingRotationSectors()) return;

	// Center coords
	const cx = w / 2;
	const cy = h / 2;
	const symMode = symSelect.value;
	const octant = (symMode === '8xITR') || (symMode === '8xMagic');
	const px = 1 / viewState.scale;  // one screen pixel, in stitch units

	// Inactive area: bottom, left, and right triangles, plus (octant
	// modes) the left half of the top wedge
	const inactive = new Path2D();
	const tri = (ax, ay, bx, by) => { inactive.moveTo(ax, ay); inactive.lineTo(bx, by); inactive.lineTo(cx, cy); inactive.closePath(); };
	tri(0, h, w, h);    // bottom
	tri(0, 0, 0, h);    // left
	tri(w, 0, w, h);    // right
	if (octant) tri(0, 0, cx, 0);  // top-left half of the top wedge

	c.save();

	// 1. Dark fade
	c.fillStyle = "rgba(0, 0, 0, 0.6)";
	c.fill(inactive);

	// 2. Light diagonal hatch, so the inactive area also reads over dark stitches
	c.clip(inactive);
	c.beginPath();
	const spacing = 8 * px;
	for (let t = -h; t <= w; t += spacing) {
		c.moveTo(t, 0);
		c.lineTo(t + h, h);
	}
	c.strokeStyle = "rgba(255, 255, 255, 0.45)";
	c.lineWidth = 1 * px;
	c.stroke();
	c.restore();

	// 3. Thin bright outline around the active (drawable) region:
	//    the top wedge, or its right half in octant modes
	const active = new Path2D();
	active.moveTo(octant ? cx : 0, 0);
	active.lineTo(w, 0);
	active.lineTo(cx, cy);
	active.closePath();

	c.save();
	c.lineJoin = "round";
	c.strokeStyle = "rgba(0, 0, 0, 0.8)";   // dark edge, for contrast on light stitches
	c.lineWidth = 4 * px;
	c.stroke(active);
	c.strokeStyle = "#ffd84d";              // bright yellow
	c.lineWidth = 2 * px;
	c.stroke(active);
	c.restore();
}

symSelect.addEventListener('change', () => {
    // 1. If 4xITR or 8xITR Symmetry is turned on, ensure the user knows it works best on a Square
	// (render() shows the warning banner via updateSymmetryWarning)

    // 2. Immediately redraw the canvas to show/hide the dark mask
    render();
});

// Rotation modes mirror strokes as if the chart were square. Show a
// banner, with a Crop to Square button, while one is on and the chart
// isn't square. Called from render(), so it follows resizes, crops, undo.
const symmetryWarning = document.getElementById('symmetryWarning');
// × hides the banner for this mode and chart size; it comes back if
// either changes and the chart still isn't square
let symmetryWarningDismissedFor = null;
const symmetryWarningKey = () => `${symSelect.value}:${drawCanvas.width}x${drawCanvas.height}`;

function updateSymmetryWarning() {
    const w = drawCanvas.width, h = drawCanvas.height;
    const show = usingRotationSectors() && w && h && w !== h &&
                 symmetryWarningKey() !== symmetryWarningDismissedFor;
    symmetryWarning.classList.toggle('hidden', !show);
    if (show) {
        const mode = symSelect.options[symSelect.selectedIndex].text.trim();
        document.getElementById('symmetryWarningText').textContent =
            `${mode} needs a square chart; this one is ${w}×${h}, so mirrored stitches won't line up.`;
    }
}
document.getElementById('symmetryCropBtn').addEventListener('click', () => {
    document.getElementById('cropToSquareBtn').click();  // asks to confirm
});
document.getElementById('symmetryExpandBtn').addEventListener('click', () => {
    document.getElementById('expandToSquareBtn').click();
});
document.getElementById('symmetryWarningClose').addEventListener('click', () => {
    symmetryWarningDismissedFor = symmetryWarningKey();
    symmetryWarning.classList.add('hidden');
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