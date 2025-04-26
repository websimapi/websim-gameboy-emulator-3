// Main application file
import { setupUI, adjustCanvasZoom } from './ui.js';
import { initAudio, tryEnableAudio, activateAudio } from './audio.js';
import { initGameboy, loadROM, setEmulationSpeed } from './gameboy-interface.js';

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
        
        // Add keyboard shortcuts for speed control
        if (e.code === 'Equal' || e.code === 'NumpadAdd') { // + key
            e.preventDefault();
            import('./gameboy-interface.js').then(module => module.increaseSpeed());
        }
        if (e.code === 'Minus' || e.code === 'NumpadSubtract') { // - key
            e.preventDefault();
            import('./gameboy-interface.js').then(module => module.decreaseSpeed());
        }
        if (e.code === 'Digit0' || e.code === 'Numpad0') { // 0 key
            e.preventDefault();
            import('./gameboy-interface.js').then(module => module.resetSpeed());
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

    // Initial setup - trigger activation on first user interaction
    document.addEventListener('click', () => {
        activateAudio();
    }, { once: true });
    
    // Set initial emulation speed to normal (1.0x)
    // This is a solution to the reported "running at 2x speed" issue
    window.addEventListener('load', () => {
        // Delay to ensure gameboy is initialized if loaded from a previous state
        setTimeout(() => {
            if (gameboy) {
                setEmulationSpeed(1.0);
            }
        }, 500);
    });
    
    // Make loadROM globally accessible
    window.loadROM = loadROM;
});

// Export functions for other modules
export { 
    loadROM
};