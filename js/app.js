// Main application file
import { setupUI, adjustCanvasZoom } from './ui.js';
import { initAudio, tryEnableAudio } from './audio.js';
import { initGameboy, loadROM } from './gameboy-interface.js';

// Application state
let gameboy = null;
let audioContext = null;
let isPaused = false;
let isSoundEnabled = true;
let wasRomLoaded = false;

document.addEventListener('DOMContentLoaded', () => {
    // Set up UI elements and event listeners
    setupUI({
        onGameboyInitialized: (gb) => { gameboy = gb; },
        onAudioContextInitialized: (ctx) => { audioContext = ctx; },
        onPause: (paused) => { isPaused = paused; },
        onSoundToggle: (enabled) => { isSoundEnabled = enabled; },
        onROMLoaded: () => { wasRomLoaded = true; },
        getState: () => ({ 
            gameboy, 
            audioContext, 
            isPaused, 
            isSoundEnabled, 
            wasRomLoaded 
        })
    });

    // Initialize audio system
    initAudio();

    // Adjust canvas zoom based on screen size
    adjustCanvasZoom();
    window.addEventListener('resize', adjustCanvasZoom);

    // Prevent spacebar from triggering buttons
    window.addEventListener('keydown', (e) => {
        if (e.code === 'Space') {
            e.preventDefault();
        }
        tryEnableAudio();
    });

    // Handle touch events correctly on mobile
    document.addEventListener('touchstart', (e) => {
        if (e.target.tagName !== 'BUTTON' && e.target.tagName !== 'INPUT') {
            e.preventDefault();
        }
        tryEnableAudio();
    }, { passive: false });

    // Initial setup - automatically initialize on first interaction
    document.addEventListener('click', () => {
        if (!gameboy) {
            initGameboy();
        }
        tryEnableAudio();
    }, { once: true });
});

// Export functions for other modules
export { 
    loadROM
};