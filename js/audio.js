// Audio handling functionality
import { hideOverlay, hideSoundNotification } from './ui.js';
import { initGameboy } from './gameboy-interface.js';

let audioContext = null;

function initAudio() {
    // We'll create the actual context on user interaction to comply with browser policies
}

// Check if AudioContext is suspended and show UI accordingly
function checkAudioContext() {
    try {
        if (!audioContext) return;
        
        if (audioContext.state === 'suspended') {
            showSoundNotification();
        } else {
            hideSoundNotification();
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
    try {
        if (!audioContext) {
            // Create a new AudioContext (handles prefixes automatically)
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            audioContext = new AudioContextClass();
        }
        
        audioContext.resume().then(() => {
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
        }).catch(err => {
            console.error('Failed to get audio permission:', err);
        });
    } catch (err) {
        console.error('Error creating AudioContext:', err);
    }
}

// Try to enable audio on any user interaction
function tryEnableAudio() {
    if (!audioContext) {
        activateAudio();
        return;
    }
    
    if (audioContext.state === 'suspended') {
        resumeAudioContext();
    }
}

// Get the current AudioContext for the gameboy initialization
function getAudioContext() {
    return audioContext;
}

export {
    initAudio,
    checkAudioContext,
    resumeAudioContext,
    activateAudio,
    tryEnableAudio,
    getAudioContext
};