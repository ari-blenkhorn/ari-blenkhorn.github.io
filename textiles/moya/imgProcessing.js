
const thresholdBtn = document.getElementById('thresholdBtn');
const thresholdRange = document.getElementById('thresholdRange');
const threshValDisplay = document.getElementById('threshVal');
const ditherStrength = document.getElementById('ditherStrength');
const ditherValDisplay = document.getElementById('ditherVal');
const serpentineScan = document.getElementById('serpentineScan');
const validateWhileDithering = document.getElementById('validateWhileDithering');
const ditherColors = document.getElementById('ditherColors');

/** GLOBAL COMMANDS **/

/** Helper class for locking pixels while dithering **/

class PixelLock {
    constructor(x = 10, y = 10) {
        this.locked = Array(x*y).fill(false);
        this.w = x;
        this.h = y;
    }

    lockPixel(x, y) {
        let idx = x + y*this.w;
        this.locked[idx] = true;
    }

    isLocked(x,y) {
        let idx = x + y*this.w;
        return this.locked[idx] ;
    }
}

/** Helper class for RGB color operations **/

class Color3 {
	constructor(r = 0, g = 0, b = 0) {
        // Clamp and store internally as 0.0 - 1.0
        this.r = Math.max(0, Math.min(1, r));
        this.g = Math.max(0, Math.min(1, g));
        this.b = Math.max(0, Math.min(1, b));
    }

    // predefined colors
    static white() { return new Color3(1, 1, 1); }
    static black() { return new Color3(0, 0, 0); }

/** 
     * Square of cartesian distance between two Color3s 
     * @param {Color3} cA
     * @param {Color3} cB
     * @returns {float}
     */
	// avoid square root by using d^2
    // Math (Distance in 0-1 space)
    static distanceSq(cA, cB) {
        return (cB.r - cA.r) ** 2 + 
               (cB.g - cA.g) ** 2 + 
               (cB.b - cA.b) ** 2;
    }
	
/** 
     * Creates a Color3 from 0-255 values 
     * @param {number} r, g, b (0-255)
     * @returns {Color3}
     */
    static fromRGB(r, g, b) {
        return new Color3(r / 255.0, g / 255.0, b / 255.0);
    }

/** 
     * Creates a Color3 from hex string 
     * @param {string} hexString
     */
    static fromHex(hexString) {
        hexString = hexString.replace(/^#/, '');
        const r = parseInt(hexString.slice(0, 2), 16) / 255;
        const g = parseInt(hexString.slice(2, 4), 16) / 255;
        const b = parseInt(hexString.slice(4, 6), 16) / 255;
        return new Color3(r, g, b);
    }

/** 
     * Creates a hex string from Color3
     * @param {Color3} color
     * @returns {string}
     */
    static toHex(color) {
        const to255 = (n) => {
            const val = Math.max(0, Math.min(255, Math.round(n * 255)));
            return val.toString(16).padStart(2, '0');
        };
        return `#${to255(color.r)}${to255(color.g)}${to255(color.b)}`.toUpperCase();
    }
/** 
     * Check value-equality of two Color3s
     * @param {Color3} cA
     * @param {Color3} cB
     * @returns {boolean}
     */
    static equal(cA, cB)
    {
        return ( (cA.r == cB.r) && (cA.g == cB.g) && (cA.b == cB.b) ); 
    }

    /** 
     * Print a Color3 to console
     * @param {Color3} color
     * @param {string} prefix
     * @returns {void}
     */
    static print(color, prefix="") {
        console.log( prefix + color.r + "," + color.g + "," + color.b + " - " + Color3.toHex(color));
    }
}


/** Helper to Transfer/Process Data between Layers **/
function processBackgroundToDrawing(processingFunction, undoLabel = 'image processing') {
    if (!bgCanvas.width || !bgCanvas.height) {
        alert("Please load a background image first.");
        return;
    }

    recordUndo(undoLabel);

    // Ensure the Drawing Layer matches the Background size
    drawCanvas.width = bgCanvas.width;
    drawCanvas.height = bgCanvas.height;

    // Get fresh data from the BACKGROUND layer
    const id = bgCtx.getImageData(0, 0, bgCanvas.width, bgCanvas.height);

	// Get current palette (as Color3s)
    let colA = Color3.fromHex(colorAInput.value);
    let colB = Color3.fromHex(colorBInput.value);
	const palette = [colA, colB ] ;

    //console.log("colorA: " + colorAInput.value);
    //console.log("colorB: " + colorBInput.value);
    
    // Pass data to the specific logic function
    const processedData = processingFunction(id, palette);

    // Put results into the DRAWING layer
    drawCtx.putImageData(processedData, 0, 0);

    // Reset states and refresh
	validationOutput = [];  // clear old errors
    validationStats = null;
    vStatsDirty = true;
    setDirty(true);
    render();
}

/** 2. Threshold Logic **/
thresholdBtn.addEventListener('click', () => {
    processBackgroundToDrawing((id, palette /*ignored*/) => {
		// 1. Get the current pixels
		const d = id.data;

		// 2. Read the slider value
		const thresholdVal = parseInt(thresholdRange.value);

		// 3. Loop through pixels (R, G, B, A)
 
        for (let i = 0; i < d.length; i += 4) {
            const luminance = (d[i] * 0.299 + d[i+1] * 0.587 + d[i+2] * 0.114);
            const v = luminance >= thresholdVal ? 255 : 0;
            d[i] = d[i+1] = d[i+2] = v;
            d[i+3] = 255; // Opaque
        }
        return id;
    }, 'threshold');
});

function globalThreshold() {


    // 6. Flag for Revert button and trigger visual update
	setDirty(true);
	validationOutput = [];  // clear old errors
	vStatsDirty = true;

	render();
}

thresholdRange.addEventListener('input', () => {
    threshValDisplay.innerText = thresholdRange.value;
});

ditherStrength.addEventListener('input', () => {
    ditherValDisplay.innerText = ditherStrength.value;
});

// Helper to work with pixels for dithering
// when they're stored RGBA as 4 sequential floats in a big array 
/** 
     * Reads value for pixel(x,y) from pxArray, 
     * using row width 'w' to locate data in 1D RGBA array
     * @param {float[]} pxArray
     * @param {number} x
     * @param {number} y
     * @param {number} w 
     * @returns {Color3}
     */

function GetPixelAsColor3(pxArray, x, y, w)
{
    const pixNum = (y * w + x);
    const i =  pixNum * 4;

    return new Color3(pxArray[i]/255, pxArray[i+1]/255, pxArray[i+2]/255);
}



/** 3. Dither Logic **/
document.getElementById('ditherBtn').addEventListener('click', () => {
	/* Floyd-Steinberg with dither strength slider and boustrodephon option */
    processBackgroundToDrawing((id, palette) => {
        // Match against black and white (A light, B dark), or against the
        // display colors of A and B. Either way palette[0] is A.
        if (ditherColors.value !== 'ab') palette = [Color3.white(), Color3.black()];

        const w = id.width;
        const h = id.height;
        const d = id.data;
        const strength = parseFloat(ditherStrength.value) / 100;
        const useSerpentine = serpentineScan.checked;

        //console.log("PALETTE: ");
        //Color3.print(palette[0], "0 - ");
        //Color3.print(palette[1], "1 - ");
        

// TODO - we're working top down but this counts from crafting row 1
// i.e. row h.  Flip if we have an even number of rows (because if bottom=A, top=B)

        let firstRowColorIdx = firstRowAToggle.checked ? 0 : 1;
        if (h % 2 == 0)
            firstRowColorIdx = 1 - firstRowColorIdx;

        // Each pixel as a single value t: how far it is from B (0) toward A (1).
        // Dithering spreads the error in t, not in red, green and blue: a mix
        // of two colors can only make shades on the line between them, so
        // error in any other direction (a blue sky's blueness, say, when
        // dithering to black and white) can never be paid off, and it piles
        // up until whole columns come out solid. For black and white, t is
        // the pixel's lightness. Pixels beyond A or B count as A or B, for the
        // same reason.
        const [colA, colB] = palette;
        const ab = [colA.r - colB.r, colA.g - colB.g, colA.b - colB.b];
        const abLen2 = ab[0] * ab[0] + ab[1] * ab[1] + ab[2] * ab[2] || 1;
        const toT = (ditherColors.value !== 'ab')
            ? (r, g, b) => (r * 0.299 + g * 0.587 + b * 0.114) / 255
            : (r, g, b) => ((r / 255 - colB.r) * ab[0] + (g / 255 - colB.g) * ab[1] + (b / 255 - colB.b) * ab[2]) / abLen2;
        const t = new Float32Array(w * h);
        for (let p = 0; p < w * h; p++) {
            t[p] = Math.max(0, Math.min(1, toT(d[p * 4], d[p * 4 + 1], d[p * 4 + 2])));
        }
        const isA = new Uint8Array(w * h);  // the result: 1 for A, 0 for B

        // Set up 'forced' flags if needed
        const keepValid = validateWhileDithering.checked;
        const forced = keepValid ? new PixelLock(w, h) : [];
        
        // Confirmed:  y looping from 0 --> h-1  is filling in the chart TOP DOWN
        // so locking (x,y+1) is locking the pixel BELOW current, as desired
        // Confirmed:  We are reading the source image top down
        for (let y = 0; y < h; y++) {
            // Determine scan direction
            const reverse = useSerpentine && (y % 2 !== 0);
            // Determine current row color index into palette
            let currRowColorIdx = (y % 2 == 0) ? firstRowColorIdx : (1 - firstRowColorIdx);
            // and fetch that color
            let currRowColor = palette[currRowColorIdx];
            //console.log(`currRowColor (row ${y}) ${Color3.toHex(currRowColor)}`)

            // Loop right-to-left or left-to-right
            for (let x = (reverse ? w - 1 : 0); reverse ? (x >= 0) : (x < w); reverse ? x-- : x++) {
                const pixNum = (y * w + x);
                const i =  pixNum * 4;

                let newColor = t[pixNum] >= 0.5 ? colA : colB;
                //if (y < 4)
                //    console.log( `(${x},${y}) old, paletteMatch: ${Color3.toHex(oldColor)}, ${Color3.toHex(newColor)}`  );

                if (keepValid)
                {
                    // handle mosaic restrictions, change newColor if needed

                    // row 0 (bottom of design) must be 'correct'
                    // i.e. pixel color == row-color
                    // same for first/top row
                    // These override dithered color
                    if (y == 0)
                    {
                        // this can't mess up the pixel above
                        // either that pixel is already row-correct,
                        // and doesn't care what we do,
                        // or it's row-wrong and using this one as anchor

                        newColor = currRowColor;
                        forced.lockPixel(x,y);
                        //console.log(`using rowColor for (${x},${y}) b/c we're on row 0 - using ${Color3.toHex(newColor)}`);
                    }
                    else if (y == h-1)
                    {
                        newColor = currRowColor;
                        forced.lockPixel(x,y);
                        //console.log(`using rowColor for (${x},${y}) b/c we're on the top row - ${Color3.toHex(newColor)}`);
                    }
                    else
                    {
                        if (forced.isLocked(x,y) == true)
                        {   
                            // if pixel(x,y)  has already been forced
                            // based on pixel above
                            //    --> set temp(x,y) to correct color for this row
                            //    --> use that color as newColor for propagating error
                            //console.log("(" + x + "," + y + ") - FORCED - desired: " + Color3.toHex(newColor) + " set: " + Color3.toHex(currRowColor));
                            newColor = currRowColor;
                        }
                        else
                        {                            
                            // this pixel is unforced

                            // if we're trying to set it to 'correct' row color,
                            //    --> go ahead and use color from dithering to set temp(x,) 
                            //    --> and propagate error as normal

                            if (newColor == currRowColor)
                            {
                                //console.log("(" + x + "," + y + ") - unforced, correct color - " + Color3.toHex(newColor));
                            }
                            else
                            {
                                //console.log("(" + x + "," + y + ") - SPICY PIXEL (unforced) - desired: " + Color3.toHex(newColor));

                                // this stitch is wrong and unforced
                                // to stay that way, it must have correct color above and below

                                // the stitch above must be the right color for its row,
                                // or this one would have been forced

                                // If current stitch doesn't match stitch above, 
                                // override newColor for self.
                                //
                                // If current does match stitch above, don't override newColor.
                                // Force the stitch _below_ current to match, 
                                // but don't change its color yet,
                                // just mark it as forced.
                                // We'll actually set it when we get to that pixel.
                                // (the row below has to be the same color as the row above, so if 'up' 
                                // is good, 'dn' has to be good, therefore the top and bottom rows are no exception)

                                // y-1 is the row above y, and has already been processed and written into output image
                                //   (that's why we get upColor from 'd', not from 'pixels')
                                // y+1 is the next row, not yet processed, but we're locking the pixel that has to serve
                                // as anchor for this one

                               let upColor = GetPixelAsColor3(d, x, y - 1, w);

                                if (! Color3.equal(upColor, newColor))
                                {
                                    //console.log("overriding (" + x + "," + y + ") b/c wrong and pixel above ("
                                    //    + Color3.toHex(upColor) + ") can't anchor - desired: " + Color3.toHex(newColor) + " set: " + Color3.toHex(currRowColor));

                                    newColor = currRowColor;
                                    forced.lockPixel(x,y);
                                }
                                else
                                {
                                    //console.log("locking (" + x + "," + (y + 1) + ") b/c it has to be an anchor for (" + x + "," + y + ") - " + Color3.toHex(newColor));
                                    forced.lockPixel(x, y+1);
                                }
                            }
                        } // e/o this pixel is unforced

                    } // e/o not top or bottom row

                }  // e/o validate while dithering

                // Set the pixel to its new color in the output image

                d[i]   = newColor.r * 255;
                d[i+1] = newColor.g * 255;
                d[i+2] = newColor.b * 255;

                isA[pixNum] = newColor === colA ? 1 : 0;

                // Calculate error and apply user-defined strength
                const err = (t[pixNum] - isA[pixNum]) * strength;

                // Adjust neighbor offsets based on direction
                const dir = reverse ? -1 : 1;

                // Diffuse Error: Right(7), Bottom-Left(3), Bottom(5), Bottom-Right(1)
                distributeError(t, x + dir, y,     w, h, err, 7/16);
                distributeError(t, x - dir, y + 1, w, h, err, 3/16);
                distributeError(t, x,       y + 1, w, h, err, 5/16);
                distributeError(t, x + dir, y + 1, w, h, err, 1/16);
            }
        }

        // The chart layer holds A as white and B as black (the palette only
        // colors the display), so store each stitch that way, not in the
        // palette colors it was matched to
        for (let p = 0; p < w * h; p++) {
            const v = isA[p] ? 255 : 0;
            d[p * 4] = d[p * 4 + 1] = d[p * 4 + 2] = v;
            d[p * 4 + 3] = 255;
        }
        return id;
    }, 'dither');
});

/** Helper to safely add error to a neighbor pixel (t: one value per pixel) **/
function distributeError(t, x, y, w, h, err, weight) {
    if (x < 0 || x >= w || y >= h)
        return;

    t[y * w + x] += err * weight;
}
/** 
     * Return black or white, whichever is closest to cOld
     * @param {Color3} cOld
     * @returns {Color3}
     */

function FindClosestPaletteColorBW(cOld)
{
	const dSq = Color3.distanceSq( cOld, Color3.white() );
	if ( dSq < 0.5) 
		return Color3.white();
	else
		return Color3.black();
}

/** 
     * Find the palette color with smallest distance to cOld
     * @param {Color3} cOld
     * @param {Color3[]} palette
     * @returns {Color3}
     */

function FindClosestPaletteColor(cOld, palette)
{
	let cClosest = palette[0];
    // Use Infinity to ensure the first comparison always succeeds
	let closestDistSq = Infinity;
	
	for (const cPal of palette)
	{
		const d2 = Color3.distanceSq(cOld, cPal);
		if (d2 < closestDistSq)
		{
			cClosest = cPal;
			closestDistSq = d2;
		}
	}

	return (cClosest);
}
