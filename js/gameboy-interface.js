// Interface with GameboyJS library
import { getAudioContext, tryEnableAudio, checkAudioContext } from './audio.js';
import { enableButtons, hideSoundNotification, hideOverlay } from './ui.js';

// GameBoy instance
let gameboy = null;
let currentSpeed = 1.0;

// Initialize the gameboy with proper audio context handling
function initGameboy() {
    const canvas = document.getElementById('canvas');
    const options = {
        zoom: 2
    };

    gameboy = new GameboyJS.Gameboy(canvas, options);
    window.gameboy = gameboy; // Make it globally accessible
    
    // Explicitly associate the AudioContext with the gameboy APU
    const audioCtx = getAudioContext();
    if (audioCtx && gameboy && gameboy.cpu && gameboy.cpu.apu) {
        gameboy.cpu.apu.audioContext = audioCtx;
    }
    
    hideOverlay();
    
    // Set initial speed
    setEmulationSpeed(currentSpeed);
    
    return gameboy;
}

// Set the emulation speed (0.5 to 2.0)
function setEmulationSpeed(speed) {
    if (!gameboy || !gameboy.cpu) return;
    
    currentSpeed = Math.max(0.5, Math.min(2.0, speed));
    
    // Override the frame timing in the CPU
    const originalFrame = gameboy.cpu.frame;
    gameboy.cpu.frame = function() {
        if (!this.isPaused) {
            // Adjust timeout based on speed (higher speed = shorter timeout)
            const frequency = GameboyJS.Screen.physics.FREQUENCY * currentSpeed;
            this.nextFrameTimer = setTimeout(this.frame.bind(this), 1000 / frequency);
        }
        
        try {
            var vblank = false;
            while (!vblank) {
                var oldInstrCount = this.clock.c;
                if (!this.isHalted) {
                    var opcode = this.fetchOpcode();
                    GameboyJS.opcodeMap[opcode](this);
                    this.r.F &= 0xF0; // tmp fix

                    if (this.enableSerial) {
                        var instr = this.clock.c - oldInstrCount;
                        this.clock.serial += instr;
                        if (this.clock.serial >= 8 * this.SERIAL_INTERNAL_INSTR) {
                            this.endSerialTransfer();
                        }
                    }
                } else {
                    this.clock.c += 4;
                }

                var elapsed = this.clock.c - oldInstrCount;
                vblank = this.gpu.update(elapsed);
                this.timer.update(elapsed);
                this.input.update();
                this.apu.update(elapsed);
                this.checkInterrupt();
            }
            this.clock.c = 0;
        } catch (e) {
            this.gameboy.handleException(e);
        }
    };
    
    // Update speed display
    const speedDisplay = document.getElementById('speedDisplay');
    if (speedDisplay) {
        speedDisplay.textContent = `${currentSpeed.toFixed(1)}x`;
    }
}

// Speed adjustment functions
function increaseSpeed() {
    setEmulationSpeed(currentSpeed + 0.1);
}

function decreaseSpeed() {
    setEmulationSpeed(currentSpeed - 0.1);
}

function resetSpeed() {
    setEmulationSpeed(1.0);
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
    
    // Make sure we have a handler for reading the file
    const reader = new FileReader();
    reader.onload = function(e) {
        const romData = new Uint8Array(e.target.result);
        
        // Load the ROM data into the gameboy
        if (gameboy && gameboy.cpu) {
            gameboy.cpu.loadRom(romData);
            gameboy.startRom({ data: romData });
            
            // Enable sound by default
            gameboy.setSoundEnabled(true);
            
            // Check for audio context state after ROM is loaded
            setTimeout(() => {
                try {
                    checkAudioContext();
                } catch (e) {
                    console.error("Error checking audio context:", e);
                }
            }, 100);
        }
    };
    
    reader.readAsArrayBuffer(file);
    
    window.wasRomLoaded = true;
    
    // Always try to enable audio when loading a ROM
    tryEnableAudio();
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
    setupTouchButton,
    setEmulationSpeed,
    increaseSpeed,
    decreaseSpeed,
    resetSpeed,
    currentSpeed
};