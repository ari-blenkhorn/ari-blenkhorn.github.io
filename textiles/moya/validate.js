validateBtn.addEventListener('click', () => {
    if (!drawCanvas.width) return;

    const w = drawCanvas.width;
    const h = drawCanvas.height;
    const id = drawCtx.getImageData(0, 0, w, h);
    const d = id.data;
    const bottomIsWhite = firstRowAToggle.checked;

    // Pass 1: Pre-calculate "Correctness" (1 = Correct, 0 = Incorrect)
    // Using a TypedArray (Uint8Array) for high-performance memory usage
    const correctnessMap = new Uint8Array(w * h);

    for (let row = 0; row < h; row++) {
        const rawY = (h - 1) - row;
        const expectedWhite = (row % 2 === 0) ? bottomIsWhite : !bottomIsWhite;

        for (let x = 0; x < w; x++) {
            const i = (rawY * w + x) * 4;
            const luminance = (d[i] * 0.299 + d[i+1] * 0.587 + d[i+2] * 0.114);
            const isPixelWhite = luminance >= 128;

            // Store correctness at the same index as the pixel
            correctnessMap[rawY * w + x] = (isPixelWhite === expectedWhite) ? 1 : 0;
        }
    }

	// Pass 2: Identify Types & Calculate Stats
	validationOutput = [];
    let invalidCount = 0;
    let topAnchorCount = 0;

    for (let row = 0; row < h; row++) {
        const rawY = (h - 1) - row;

        for (let x = 0; x < w; x++) {
            const idx = rawY * w + x;
            const isCurrentCorrect = correctnessMap[idx] === 1;

            let isTopAnchor = false;
			let isHidden = false;
            // Anchor Logic is based on finding top anchors
            // We identify dual/bottom anchors at render time if needed
            //
            // Edge Safety: Bottom row (row 0) and next row (1) cannot be top anchors;
			//                  there is no stitch 2 rows down to connect to.
			//              Bottom row cannot be hidden;
			//					would require row 1 to be top anchor and row -1 to be bottom anchor.
            //              Top row (row n-1) cannot be hidden;
			//					would require row n (off the chart) to be top anchor and row n-2 to be bottom anchor.
            //              Top row (n-1) and next row (n-2) cannot be bottom anchors;
            //                  there is no stitch 2 rows up to connect to.
            if (row > 0 && row < h - 1) {
                const dn = ((h - 1) - (row - 1)) * w + x;
                const dn2 = ((h - 1) - (row - 2)) * w + x;
                const up = ((h - 1) - (row + 1)) * w + x;

                if (isCurrentCorrect && row > 1)
				{
					if (correctnessMap[dn] === 0 && correctnessMap[dn2] === 1) {
						isTopAnchor = true;
					}
                }
				else // current is wrong, but might be saved by a mosaic stitch
				{
					if (correctnessMap[up] === 1 && correctnessMap[dn] === 1)
						isHidden = true;
					// top anchor stitch ('up') will be marked when we process the next row
				} 
            }

            if (isTopAnchor) {
                validationOutput.push({ x, y: rawY, type: 'top-anchor' });
                topAnchorCount++;
            } else if (!isCurrentCorrect && !isHidden) {
                validationOutput.push({ x, y: rawY, type: 'invalid' });
                invalidCount++;
            }
			// if it's not an anchor, and it's not invalid, no need to mark it
        }
    }

 
    // 3. Update Summary Stats
    const totalPixels = w * h;
    const errorPercent = ((invalidCount / totalPixels) * 100).toFixed(2);

    // Store stats for the render() function to display
    validationStats = {
        invalid: invalidCount,
        topAnchor: topAnchorCount,
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

    const w = drawCanvas.width;
    const h = drawCanvas.height;
    const imageData = drawCtx.getImageData(0, 0, w, h);
    const data = imageData.data;
    const bottomIsWhite = firstRowAToggle.checked;

    let stitchesRepaired = 0;

    // 2. Iterate through the specific errors found in the last validation

    if (repairType == REPAIR.toggleAll)
    {
        validationOutput.forEach(err => {
            if (err.type === 'invalid') {
                // Calculate which BTT row this pixel is in to get the correct color
                // row = (h - 1) - rawY
                const row = (h - 1) - err.y;
                const targetValue = ((row % 2 === 0) ? bottomIsWhite : !bottomIsWhite) ? 255 : 0;

                const i = (err.y * w + err.x) * 4;

                // Apply the repair to the buffer
                data[i]     = targetValue;
                data[i + 1] = targetValue;
                data[i + 2] = targetValue;
                data[i + 3] = 255;

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
