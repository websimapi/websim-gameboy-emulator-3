// Interface with GameboyJS library
import { checkAudioContext, tryEnableAudio } from './audio.js';
import { enableButtons, hideSoundNotification, hideOverlay } from './ui.js';

// GameBoy instance
let gameboy = null;

// Initialize the gameboy with proper audio context handling
function initGameboy() {
    const canvas = document.getElementById('canvas');
    const options = {
        zoom: 2
    };

    gameboy = new GameboyJS.Gameboy(canvas, options);
    window.gameboy = gameboy; // Make it globally accessible
    
    hideOverlay();
    return gameboy;
}

// Custom ROM loading function
function loadROM(file) {
    if (!gameboy) {
        // First-time initialization with user interaction
        initGameboy();
    }
    
    // Reset pause state when loading a new ROM
    const pauseBtn = document.getElementById('pauseBtn');
    pauseBtn.textContent = 'Pause';
    enableButtons();
    
    // Enable sound by default
    if (gameboy) {
        gameboy.setSoundEnabled(true);
        
        // Check for audio context state after ROM is loaded
        setTimeout(checkAudioContext, 100);
    }
    
    window.wasRomLoaded = true;
}

// Setup touch controls
function setupTouchButton(buttonId, keyName) {
    const button = document.getElementById(buttonId);
    
    button.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (gameboy) gameboy.input.pressKey(keyName);
        tryEnableAudio();
    });
    
    button.addEventListener('touchend', (e) => {
        e.preventDefault();
        if (gameboy) gameboy.input.releaseKey(keyName);
    });
    
    // For mouse clicks (useful for testing on desktop)
    button.addEventListener('mousedown', () => {
        if (gameboy) gameboy.input.pressKey(keyName);
        tryEnableAudio();
    });
    
    button.addEventListener('mouseup', () => {
        if (gameboy) gameboy.input.releaseKey(keyName);
    });
    
    // Prevent holding the button from selecting text
    button.addEventListener('mouseout', () => {
        if (gameboy) gameboy.input.releaseKey(keyName);
    });
}

export {
    initGameboy,
    loadROM,
    setupTouchButton
};