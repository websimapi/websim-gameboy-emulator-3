// Interface with GameboyJS library
import { getAudioContext, tryEnableAudio, checkAudioContext } from './audio.js';
import { enableButtons, hideSoundNotification, hideOverlay } from './ui.js';

// GameBoy instance
let gameboy = null;
let currentSpeed = 1.0;
let errorCount = 0;
let lastErrorTime = 0;

// MBC3 cartridge clock handling patch
// Apply a patch to the MBC3 implementation to handle clock operations
function applyMBC3ClockPatch() {
    if (GameboyJS && GameboyJS.MBC) {
        // Only patch if not already patched
        if (GameboyJS.MBC.clockPatched) return;
        
        // Override the MBC3 implementation to handle clock operations without exceptions
        const originalMBC3 = GameboyJS.MBC.getMbcInstance;
        GameboyJS.MBC.getMbcInstance = function(memory, type) {
            const instance = originalMBC3.call(this, memory, type);
            
            // If this is an MBC3 cartridge, patch the manageWrite method
            if (type >= 0x0F && type <= 0x13) {
                const originalManageWrite = instance.manageWrite;
                
                // Override manageWrite to handle clock operations
                instance.manageWrite = function(addr, value) {
                    if ((addr & 0xF000) === 0x6000 || (addr & 0xF000) === 0x7000) {
                        // Instead of throwing an exception, silently handle clock operations
                        // This is a dummy implementation that doesn't actually track time
                        this.clockLatch = value;
                        return;
                    }
                    
                    // Call the original method for all other cases
                    return originalManageWrite.call(this, addr, value);
                };
                
                // Add dummy clock registers (RTC registers in real MBC3)
                instance.rtcRegisters = {
                    seconds: 0,
                    minutes: 0,
                    hours: 0,
                    days: 0,
                    control: 0
                };
                
                // Override readRam to handle RTC register reads
                const originalReadRam = instance.readRam;
                instance.readRam = function(addr) {
                    // RTC registers are mapped to RAM addresses 0x08-0x0C
                    if (this.ramBank >= 0x08 && this.ramBank <= 0x0C) {
                        switch (this.ramBank) {
                            case 0x08: return this.rtcRegisters.seconds;
                            case 0x09: return this.rtcRegisters.minutes;
                            case 0x0A: return this.rtcRegisters.hours;
                            case 0x0B: return this.rtcRegisters.days & 0xFF;
                            case 0x0C: return this.rtcRegisters.control;
                            default: return 0;
                        }
                    }
                    
                    // Use original method for normal RAM access
                    return originalReadRam.call(this, addr);
                };
                
                console.log("MBC3 cartridge clock patch applied");
            }
            
            return instance;
        };
        
        GameboyJS.MBC.clockPatched = true;
    }
}

// Initialize the gameboy with proper audio context handling
function initGameboy() {
    const canvas = document.getElementById('canvas');
    const options = {
        zoom: 2
    };

    gameboy = new GameboyJS.Gameboy(canvas, options);
    window.gameboy = gameboy; // Make it globally accessible
    
    // Apply the MBC3 clock patch to handle cartridges with RTC
    applyMBC3ClockPatch();
    
    // Explicitly associate the AudioContext with the gameboy APU
    const audioCtx = getAudioContext();
    if (audioCtx && gameboy && gameboy.cpu && gameboy.cpu.apu) {
        gameboy.cpu.apu.audioContext = audioCtx;
    }
    
    hideOverlay();
    
    // Set initial speed
    setEmulationSpeed(currentSpeed);
    
    // Add error handling wrapper for the frame function
    if (gameboy.cpu) {
        const originalFrame = gameboy.cpu.frame;
        gameboy.cpu.frame = function() {
            try {
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
                    // Handle specific known errors more gracefully
                    const now = Date.now();
                    if (now - lastErrorTime > 5000) {
                        // Reset error count if it's been more than 5 seconds
                        errorCount = 0;
                    }
                    
                    lastErrorTime = now;
                    errorCount++;
                    
                    if (errorCount > 10) {
                        // If we're getting too many errors in a short time, 
                        // we should pause the game to prevent browser freezing
                        this.isPaused = true;
                        console.error("Too many errors, pausing emulation", e);
                        const errorElem = document.getElementById('error');
                        if (errorElem) {
                            errorElem.innerHTML = "Emulation paused due to repeated errors. The ROM may not be fully compatible.";
                            errorElem.classList.add('show');
                        }
                        this.gameboy.setStatus('Emulation paused due to errors');
                    } else {
                        // For occasional errors, just log and continue
                        console.warn("Recovered from error in CPU execution:", e);
                    }
                }
            } catch (outerError) {
                // Handle any errors in our error handling code
                console.error("Critical error in emulation:", outerError);
                if (this.gameboy && this.gameboy.handleException) {
                    this.gameboy.handleException(outerError);
                }
                this.isPaused = true;
            }
        };
    }
    
    return gameboy;
}

// Set the emulation speed (0.5 to 2.0)
function setEmulationSpeed(speed) {
    if (!gameboy || !gameboy.cpu) return;
    
    currentSpeed = Math.max(0.5, Math.min(2.0, speed));
    
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
    // Reset error state
    errorCount = 0;
    lastErrorTime = 0;
    const errorElem = document.getElementById('error');
    if (errorElem) {
        errorElem.classList.remove('show');
    }
    
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
            try {
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
            } catch (e) {
                console.error("Error loading ROM:", e);
                const errorElem = document.getElementById('error');
                if (errorElem) {
                    errorElem.innerHTML = "Failed to load ROM: " + (e.message || "Unknown error");
                    errorElem.classList.add('show');
                }
            }
        }
    };
    
    reader.onerror = function(e) {
        console.error("File reading error:", e);
        const errorElem = document.getElementById('error');
        if (errorElem) {
            errorElem.innerHTML = "Failed to read ROM file";
            errorElem.classList.add('show');
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
    if (!button) return;
    
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