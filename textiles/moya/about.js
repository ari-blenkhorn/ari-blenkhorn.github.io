const aboutBtn = document.getElementById('aboutBtn');
const aboutModal = document.getElementById('aboutModal');
const closeAboutX = document.getElementById('closeAbout');
const closeAboutBtn = document.getElementById('closeAboutBtn');

/** About Modal Logic **/
function toggleAbout(show) {
    if (show) {
        aboutModal.classList.remove('hidden');
    } else {
        aboutModal.classList.add('hidden');
    }
}

aboutBtn.addEventListener('click', () => toggleAbout(true));
closeAboutX.addEventListener('click', () => toggleAbout(false));
closeAboutBtn.addEventListener('click', () => toggleAbout(false));

// Close if user clicks the dark overlay outside the box
aboutModal.addEventListener('click', (e) => {
    if (e.target === aboutModal) {
	    // 1. Show the About modal overlay
		toggleAbout(false);
	}

	// 2. Retrieve the last saved time from the stored workspace
    const saved = localStorage.getItem('imgEditorWorkspace');
    if (saved) {
        const data = JSON.parse(saved);
        if (data.lastSaved) {
            document.getElementById('lastSavedTime').innerText = data.lastSaved;
        }
    }

});