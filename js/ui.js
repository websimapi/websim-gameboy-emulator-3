// UI related functionality
import { activateAudio, tryEnableAudio } from './audio.js';
import { initGameboy, loadROM, setupTouchButton } from './gameboy-interface.js';

// References to UI elements
let pauseBtn, soundBtn, soundNotification, overlay;
let fileInput;
let appState = {};

function setupUI(state) {
    appState = state;

    // Cache UI elements
    pauseBtn = document.getElementById('pauseBtn');
    soundBtn = document.getElementById('soundBtn');
    soundNotification = document.getElementById('sound-notification');
    overlay = document.getElementById('audio-permission-overlay');
    fileInput = document.getElementById('file');
    
    const soundEnableBtn = document.getElementById('sound-enable-btn');
    const overlayEnableBtn = document.getElementById('overlay-enable-btn');

    // Setup pause button
    pauseBtn.addEventListener('click', togglePause);
    
    // Setup sound button
    soundBtn.addEventListener('click', toggleSound);
    
    // Setup touch controls
    setupTouchControls();
    
    // File input handling
    fileInput.addEventListener('change', handleFileChange);
    
    // Button event listeners for enabling audio
    soundEnableBtn.addEventListener('click', activateAudio);
    overlayEnableBtn.addEventListener('click', activateAudio);
    
    // Show the overlay to prompt for interaction
    showOverlay();
}

function togglePause() {
    const state = appState.getState();
    const newPauseState = !state.isPaused;
    appState.onPause(newPauseState);
    
    if (state.gameboy) {
        state.gameboy.pause(newPauseState);
        pauseBtn.textContent = newPauseState ? 'Resume' : 'Pause';
    }
}

function toggleSound() {
    const state = appState.getState();
    const newSoundState = !state.isSoundEnabled;
    appState.onSoundToggle(newSoundState);
    
    if (state.gameboy) {
        state.gameboy.setSoundEnabled(newSoundState);
        soundBtn.textContent = `Sound: ${newSoundState ? 'On' : 'Off'}`;
        
        // If enabling sound, also ensure AudioContext is running
        if (newSoundState) {
            tryEnableAudio();
        }
    }
}

function setupTouchControls() {
    // Set up all the touch buttons
    setupTouchButton('upBtn', 'UP');
    setupTouchButton('downBtn', 'DOWN');
    setupTouchButton('leftBtn', 'LEFT');
    setupTouchButton('rightBtn', 'RIGHT');
    setupTouchButton('aBtn', 'A');
    setupTouchButton('bBtn', 'B');
    setupTouchButton('startBtn', 'START');
    setupTouchButton('selectBtn', 'SELECT');
}

function handleFileChange(e) {
    if (e.target.files[0]) {
        loadROM(e.target.files[0]);
        tryEnableAudio();
        enableButtons();
    }
}

function enableButtons() {
    pauseBtn.disabled = false;
}

function showSoundNotification() {
    soundNotification.classList.remove('hide');
    soundNotification.classList.add('show');
}

function hideSoundNotification() {
    soundNotification.classList.add('hide');
    soundNotification.classList.remove('show');
}

function showOverlay() {
    overlay.classList.add('show');
}

function hideOverlay() {
    overlay.classList.remove('show');
}

function adjustCanvasZoom() {
    const screenWidth = window.innerWidth;
    const state = appState.getState();
    let zoom = 2; // Default zoom
    
    if (screenWidth < 500) {
        zoom = 1.5;
    } else if (screenWidth > 1000) {
        zoom = 3;
    }
    
    if (state.gameboy) {
        state.gameboy.setScreenZoom(zoom);
    }
}

export {
    setupUI,
    enableButtons,
    showSoundNotification,
    hideSoundNotification,
    showOverlay,
    hideOverlay,
    adjustCanvasZoom
};