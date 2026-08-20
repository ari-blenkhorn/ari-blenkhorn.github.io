/** Final Initialization on Page Load **/
window.addEventListener('load', () => {
    // 1. Check if a workspace already exists in LocalStorage
    const saved = localStorage.getItem('imgEditorWorkspace');
    
    if (saved) {
        // If a save exists, the existing load logic will handle it
        console.log("Restoring workspace from storage...");
    } else {
        // 2. If NO save exists, initialize a clean "Default" workspace
        console.log("Initializing fresh workspace...");
        
        // starting size (defined in mosaic.js)
        drawCanvas.width = DEFAULTS.newW;
        drawCanvas.height = DEFAULTS.newH;
        bgCanvas.width = DEFAULTS.newW;
        bgCanvas.height = DEFAULTS.newW;
        displayCanvas.width = DEFAULTS.newW;
        displayCanvas.height = DEFAULTS.newW;

        // Fill with your "Clean Slate" white
        drawCtx.fillStyle = "#FFFFFF";
        drawCtx.fillRect(0, 0, drawCanvas.width, drawCanvas.height);

        // 3. Force the view to fit the browser window immediately
        resetView();
        
        // 4. Initial Render
        render();
    }
});
