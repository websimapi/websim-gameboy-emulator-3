// Audio handling functionality
import { initGameboy } from './gameboy-interface.js';
import { hideOverlay, hideSoundNotification, showSoundNotification } from './ui.js';

let audioContext = null;

function initAudio() {
    // Intentionally start without initializing the actual
    // audio context - will be created on user interaction
}

// Check if AudioContext is suspended and show UI accordingly
function checkAudioContext() {
    try {
        // Find any existing AudioContext in the window
        const audioContexts = Object.keys(window)
            .filter(key => window[key] instanceof AudioContext || window[key] instanceof webkitAudioContext)
            .map(key => window[key]);
        
        if (audioContexts.length > 0) {
            audioContext = audioContexts[0];
            
            if (audioContext.state === 'suspended') {
                showSoundNotification();
            }
        }
    } catch (e) {
        console.error("Error checking AudioContext:", e);
    }
}

// Try to resume any suspended AudioContext
function resumeAudioContext() {
    if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume().then(() => {
            console.log('AudioContext resumed successfully');
            hideSoundNotification();
            
            // Reinitialize sound in the gameboy
            const gameboy = window.gameboy;
            if (gameboy) {
                gameboy.setSoundEnabled(true);
            }
        }).catch(err => {
            console.error('Failed to resume AudioContext', err);
        });
    }
}

// Function to handle user interaction and enable audio
function activateAudio() {
    // Create a temporary AudioContext to ensure permission
    const tempContext = new (window.AudioContext || window.webkitAudioContext)();
    tempContext.resume().then(() => {
        // Permission granted, initialize the gameboy
        if (!window.gameboy) {
            initGameboy();
        }
        
        // If a game was loaded but sound was suspended, reload it
        const fileInput = document.getElementById('file');
        if (window.wasRomLoaded && fileInput.files[0]) {
            window.loadROM(fileInput.files[0]);
        }
        
        hideSoundNotification();
        hideOverlay();
        tempContext.close();
    }).catch(err => {
        console.error('Failed to get audio permission:', err);
    });
}

// Try to enable audio on any user interaction
function tryEnableAudio() {
    if (audioContext && audioContext.state === 'suspended') {
        resumeAudioContext();
    }
}

export {
    initAudio,
    checkAudioContext,
    resumeAudioContext,
    activateAudio,
    tryEnableAudio
};