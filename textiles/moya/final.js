/** Final Initialization on Page Load **/
window.addEventListener('load', () => {
    // Always start with a clean "Default" workspace. Restoring a saved
    // workspace from LocalStorage is disabled (see the commented-out
    // Workspace code in mosaic.js), so an old 'imgEditorWorkspace' entry
    // must not stop the default chart from being created.
    console.log("Initializing fresh workspace...");

    // starting size (defined in mosaic.js)
    drawCanvas.width = DEFAULTS.newW;
    drawCanvas.height = DEFAULTS.newH;
    bgCanvas.width = DEFAULTS.newW;
    bgCanvas.height = DEFAULTS.newH;
    displayCanvas.width = DEFAULTS.newW;
    displayCanvas.height = DEFAULTS.newH;

    // Fill with your "Clean Slate" white
    drawCtx.fillStyle = "#FFFFFF";
    drawCtx.fillRect(0, 0, drawCanvas.width, drawCanvas.height);
    originalSize = { w: drawCanvas.width, h: drawCanvas.height };

    // Record the starting gauge, so Change Gauge has a reference,
    // and show the starting chart size in the width/height fields
    updateGaugeReference();
    updateResizeInputs();

    // Force the view to fit the browser window immediately
    resetView();

    // Initial Render
    render();
});
