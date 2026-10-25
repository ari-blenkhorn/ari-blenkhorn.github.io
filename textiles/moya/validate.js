// Directions the rows can be worked in, for validation. A chart worked
// as one piece uses 'up': rows run left to right and are worked from the
// bottom of the chart to the top. The 4x and 8x modes work the north and
// south quadrants up and down, and the east and west quadrants right and
// left, so each quadrant's rows run along its outer edge.
// at(r, c): the (x, y) of column c in row r (row 0 is worked first).
// down: the (dx, dy) step from a stitch to the one in the row below it.
function rowDirection(dir, w, h) {
    switch (dir) {
        case 'down':  return { rows: h, cols: w, at: (r, c) => [c, r],         down: [0, -1] };
        case 'right': return { rows: w, cols: h, at: (r, c) => [r, c],         down: [-1, 0] };
        case 'left':  return { rows: w, cols: h, at: (r, c) => [w - 1 - r, c], down: [1, 0] };
        default:      return { rows: h, cols: w, at: (r, c) => [c, h - 1 - r], down: [0, 1] };
    }
}

// Validate the chart with its rows worked in direction dir. Reports only
// the stitches where include(x, y) is true, though stitches outside that
// area still count as neighbors. Adds to the output list and the counts.
function validateRows(dir, isWhite, w, h, bottomIsWhite, include, out, counts) {
    const { rows, cols, at, down } = rowDirection(dir, w, h);

    // Pass 1: Pre-calculate "Correctness" (1 = Correct, 0 = Incorrect)
    // Using a TypedArray (Uint8Array) for high-performance memory usage
    const correct = new Uint8Array(rows * cols);
    for (let r = 0; r < rows; r++) {
        const expectedWhite = (r % 2 === 0) ? bottomIsWhite : !bottomIsWhite;
        for (let c = 0; c < cols; c++) {
            const [x, y] = at(r, c);
            correct[r * cols + c] = (isWhite(x, y) === expectedWhite) ? 1 : 0;
        }
    }

    // Pass 2: Identify Types
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const [x, y] = at(r, c);
            if (!include(x, y)) continue;
            counts.total++;

            const idx = r * cols + c;
            const isCurrentCorrect = correct[idx] === 1;

            let isTopAnchor = false;
            let isHidden = false;
            // Anchor Logic is based on finding top anchors
            // We identify dual/bottom anchors at render time if needed
            //
            // Edge Safety: Bottom row (row 0) and next row (1) cannot be top anchors;
            //                  there is no stitch 2 rows down to connect to.
            //              Bottom row cannot be hidden;
            //                  would require row 1 to be top anchor and row -1 to be bottom anchor.
            //              Top row (row n-1) cannot be hidden;
            //                  would require row n (off the chart) to be top anchor and row n-2 to be bottom anchor.
            //              Top row (n-1) and next row (n-2) cannot be bottom anchors;
            //                  there is no stitch 2 rows up to connect to.
            if (r > 0 && r < rows - 1) {
                const dn = idx - cols;
                const dn2 = idx - 2 * cols;
                const up = idx + cols;

                if (isCurrentCorrect && r > 1) {
                    if (correct[dn] === 0 && correct[dn2] === 1) isTopAnchor = true;
                } else {
                    // current is wrong, but might be saved by a mosaic stitch
                    // (the top anchor 'up' is marked when we process the next row)
                    if (correct[up] === 1 && correct[dn] === 1) isHidden = true;
                }
            }

            if (isTopAnchor) {
                // (dx, dy): where its bottom anchor is, 2 rows down
                out.push({ x, y, type: 'top-anchor', dx: 2 * down[0], dy: 2 * down[1] });
                counts.topAnchor++;
            } else if (!isCurrentCorrect && !isHidden) {
                out.push({ x, y, type: 'invalid' });
                counts.invalid++;
            }
            // if it's not an anchor, and it's not invalid, no need to mark it
        }
    }
}

validateBtn.addEventListener('click', () => {
    if (!drawCanvas.width) return;

    const w = drawCanvas.width;
    const h = drawCanvas.height;
    const d = drawCtx.getImageData(0, 0, w, h).data;
    const bottomIsWhite = firstRowAToggle.checked;

    const isWhite = (x, y) => {
        const i = (y * w + x) * 4;
        return (d[i] * 0.299 + d[i+1] * 0.587 + d[i+2] * 0.114) >= 128;
    };

    validationOutput = [];
    const counts = { total: 0, invalid: 0, topAnchor: 0 };

    if (validatesByQuadrant()) {
        // 4x / 8x: a rotationally symmetric design, worked in rows, so check
        // the whole chart with each quadrant's rows along its outer edge
        const dirs = { N: 'up', S: 'down', E: 'right', W: 'left' };
        for (const q in dirs) {
            validateRows(dirs[q], isWhite, w, h, bottomIsWhite,
                         (x, y) => quadrantOf(x, y, w, h) === q, validationOutput, counts);
        }
    } else if (validatesWedgeOnly()) {
        // In the round: every wedge is worked the same way up, so only the
        // drawing wedge needs checking
        validateRows('up', isWhite, w, h, bottomIsWhite,
                     (x, y) => pixelInActiveDrawingArea(x, y, w, h), validationOutput, counts);
    } else {
        validateRows('up', isWhite, w, h, bottomIsWhite, () => true, validationOutput, counts);
    }

    // 3. Update Summary Stats
    const errorPercent = counts.total ? ((counts.invalid / counts.total) * 100).toFixed(2) : '0.00';

    // Store stats for the render() function to display
    validationStats = {
        invalid: counts.invalid,
        topAnchor: counts.topAnchor,
        // note: we don't need a separate bottom anchor count. they're symmetrical
        percent: errorPercent
    };
	vStatsDirty = false;

    // turn ON the "show Invalid" checkbox and trigger it
    validationErrorToggle.checked = true;
    validationErrorToggle.dispatchEvent(new Event('change'));

    render();
});

const REPAIR = {
    toggleAll: 1,
    smart: 2
}

document.getElementById('toggleInvalidBtn').addEventListener('click', () => {

    repairInvalid(REPAIR.toggleAll);
})

document.getElementById('smartRepairBtn').addEventListener('click', () => {

    repairInvalid(REPAIR.smart);
})

function repairInvalid(repairType)
{

    // 1. Safety Checks
    if (!drawCanvas.width) return;

	if (validationOutput.length === 0) {
        alert("Please run 'Validate' first to identify invalid pixels.");
        return;
    }

    recordUndo(repairType == REPAIR.toggleAll ? 'invalid-stitch toggle' : 'repair');

    const w = drawCanvas.width;
    const h = drawCanvas.height;
    const imageData = drawCtx.getImageData(0, 0, w, h);
    const data = imageData.data;

    let stitchesRepaired = 0;

    // 2. Iterate through the specific errors found in the last validation

    if (repairType == REPAIR.toggleAll)
    {
        validationOutput.forEach(err => {
            if (err.type === 'invalid') {
                // Every stitch is A or B, so the right color for an invalid
                // stitch is the other one (whichever way its rows run)
                const i0 = (err.y * w + err.x) * 4;
                const targetValue = data[i0] >= 128 ? 0 : 255;

                // In the round, only the drawing wedge is validated; repair
                // its copies around the chart too
                const pts = validatesWedgeOnly() ? symmetricPoints(err.x, err.y, w, h) : [[err.x, err.y]];
                pts.forEach(([px, py]) => {
                    if (px < 0 || px >= w || py < 0 || py >= h) return;
                    const i = (py * w + px) * 4;

                    // Apply the repair to the buffer
                    data[i]     = targetValue;
                    data[i + 1] = targetValue;
                    data[i + 2] = targetValue;
                    data[i + 3] = 255;
                });

                stitchesRepaired++;
            }
        });
    }
    else if (repairType == REPAIR.smart)
    {
        validationOutput.forEach(err => {
            if (err.type === 'invalid') {
                stitchesRepaired++;
            }
        });

        console.log("MISCHIEF MANAGED!");
    }
    else{ 
        // TODO complain and exit
    }

    // 3. Update the source buffer
    drawCtx.putImageData(imageData, 0, 0);

    // 4. State updates
    setDirty(true);
	vStatsDirty = true;

    // 5. AUTO-REVALIDATE: Refresh the counts and the red/cyan markers
    document.getElementById('validateBtn').click();

    console.log(`Repair complete: ${stitchesRepaired} stitches corrected.`);
}

function performLiveValidation(startX, width) {
    // 1. Safety Checks
    if (!drawCanvas.width) return;

    if (!validationStats) return;

    const w = drawCanvas.width;
    const h = drawCanvas.height;
    const d = drawCtx.getImageData(0, 0, w, h).data;
    const bottomIsWhite = firstRowAToggle.checked;

    // 1. Remove existing errors/anchors only for the affected columns
    validationOutput = validationOutput.filter(err => err.x < startX || err.x >= startX + width);

    // 2. Re-scan only the affected columns
    for (let x = startX; x < startX + width; x++) {
        if (x < 0 || x >= w) continue;

        // Pre-calculate column correctness to handle anchor (neighbor) logic
        const colCorrectness = new Uint8Array(h);
        for (let row = 0; row < h; row++) {
            const rawY = (h - 1) - row;
            const expectedWhite = (row % 2 === 0) ? bottomIsWhite : !bottomIsWhite;
            const i = (rawY * w + x) * 4;
            const lum = (d[i] * 0.299 + d[i+1] * 0.587 + d[i+2] * 0.114);
            colCorrectness[row] = ((lum >= 128) === expectedWhite) ? 1 : 0;
        }

        // Identify types for the column
        for (let row = 0; row < h; row++) {
            const rawY = (h - 1) - row;
            const isCurrentCorrect = colCorrectness[row] === 1;
            let isTopAnchor = false;

            if (row > 0 && row < h - 1) {
                if (isCurrentCorrect && colCorrectness[row-1] === 1 && colCorrectness[row+1] === 1) {
                    isTopAnchor = true;
                }
            }

            if (isTopAnchor) {
                validationOutput.push({ x, y: rawY, type: 'top-anchor' });
            } else if (!isCurrentCorrect) {
                validationOutput.push({ x, y: rawY, type: 'invalid' });
            }
        }
    }

    // 3. Recalculate global stats from the updated validationOutput array
    const invalidCount = validationOutput.filter(e => e.type === 'invalid').length;
    const topAnchorCount = validationOutput.filter(e => e.type === 'top-anchor').length;

    validationStats.invalid = invalidCount;
    validationStats.topAnchor = topAnchorCount;
    validationStats.percent = ((invalidCount / (w * h)) * 100).toFixed(2);

    // Stats are now "Clean" again
    isStatsDirty = false;
    render();
}
