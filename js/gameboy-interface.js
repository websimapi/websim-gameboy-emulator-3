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
        zoom: 2,
        // Enable RTC/clock support
        enableClock: true
    };

    gameboy = new GameboyJS.Gameboy(canvas, options);
    window.gameboy = gameboy; // Make it globally accessible
    
    // Explicitly associate the AudioContext with the gameboy APU
    const audioCtx = getAudioContext();
    if (audioCtx && gameboy && gameboy.cpu && gameboy.cpu.apu) {
        gameboy.cpu.apu.audioContext = audioCtx;
    }
    
    // Initialize RTC support
    initRTCSupport();
    
    hideOverlay();
    
    // Set initial speed
    setEmulationSpeed(currentSpeed);
    
    return gameboy;
}

// Initialize Real-Time Clock support
function initRTCSupport() {
    if (!gameboy || !gameboy.cpu) return;
    
    // Override MBC handler if needed
    const originalLoadRom = gameboy.cpu.loadRom;
    gameboy.cpu.loadRom = function(romData) {
        // Call original method
        originalLoadRom.call(this, romData);
        
        // Check if ROM uses MBC3 with clock (typically 0x0F or 0x10)
        const cartridgeType = romData[0x0147];
        if (cartridgeType === 0x0F || cartridgeType === 0x10) {
            console.log("Detected ROM with RTC support (MBC3+Timer)");
            
            // Initialize RTC registers if not already present
            if (!this.rtcRegisters) {
                this.rtcRegisters = {
                    seconds: 0,
                    minutes: 0,
                    hours: 0,
                    days: 0,
                    control: 0,
                    latchedSeconds: 0,
                    latchedMinutes: 0,
                    latchedHours: 0,
                    latchedDays: 0,
                    latchedControl: 0,
                    lastUpdate: Date.now()
                };
                
                // Override read/write handlers for RTC
                const originalReadFromBus = this.readFromBus;
                const originalWriteToBus = this.writeToBus;
                
                // Handle RTC register reads
                this.readFromBus = function(address) {
                    // Check if reading from RTC registers (0xA000-0xBFFF when selected)
                    if (address >= 0xA000 && address <= 0xBFFF && this.mbc === 3 && this.currentRamBank >= 0x08 && this.currentRamBank <= 0x0C) {
                        // Update RTC before reading
                        this.updateRTC();
                        
                        // Return the appropriate RTC register value
                        switch (this.currentRamBank) {
                            case 0x08: return this.rtcRegisters.latchedSeconds;
                            case 0x09: return this.rtcRegisters.latchedMinutes;
                            case 0x0A: return this.rtcRegisters.latchedHours;
                            case 0x0B: return this.rtcRegisters.latchedDays & 0xFF;
                            case 0x0C: return this.rtcRegisters.latchedControl;
                            default: return 0;
                        }
                    }
                    
                    // Otherwise use the original handler
                    return originalReadFromBus.call(this, address);
                };
                
                // Handle RTC register writes
                this.writeToBus = function(address, value) {
                    // Check if selecting an RTC register (writing to 0x4000-0x5FFF)
                    if (address >= 0x4000 && address <= 0x5FFF && this.mbc === 3) {
                        if (value >= 0x08 && value <= 0x0C) {
                            this.currentRamBank = value;
                            return;
                        }
                    }
                    
                    // Check if writing to RTC latch (0x6000-0x7FFF)
                    if (address >= 0x6000 && address <= 0x7FFF && this.mbc === 3) {
                        let latchData = 0;
                        
                        // Latch sequence requires 0->1 transition
                        if (latchData === 0 && value === 1) {
                            this.updateRTC();
                            this.rtcRegisters.latchedSeconds = this.rtcRegisters.seconds;
                            this.rtcRegisters.latchedMinutes = this.rtcRegisters.minutes;
                            this.rtcRegisters.latchedHours = this.rtcRegisters.hours;
                            this.rtcRegisters.latchedDays = this.rtcRegisters.days;
                            this.rtcRegisters.latchedControl = this.rtcRegisters.control;
                        }
                        
                        latchData = value;
                        return;
                    }
                    
                    // Check if writing to RTC registers (0xA000-0xBFFF when selected)
                    if (address >= 0xA000 && address <= 0xBFFF && this.mbc === 3 && this.currentRamBank >= 0x08 && this.currentRamBank <= 0x0C) {
                        switch (this.currentRamBank) {
                            case 0x08: this.rtcRegisters.seconds = value % 60; break;
                            case 0x09: this.rtcRegisters.minutes = value % 60; break;
                            case 0x0A: this.rtcRegisters.hours = value % 24; break;
                            case 0x0B: this.rtcRegisters.days = (this.rtcRegisters.days & 0x100) | value; break;
                            case 0x0C: 
                                // Control register - only lower bits are writable
                                this.rtcRegisters.control = value & 0xC1;
                                // Day counter high bit is in control register
                                if (value & 0x01) this.rtcRegisters.days |= 0x100;
                                else this.rtcRegisters.days &= 0xFF;
                                break;
                        }
                        
                        this.rtcRegisters.lastUpdate = Date.now();
                        return;
                    }
                    
                    // Otherwise use the original handler
                    originalWriteToBus.call(this, address, value);
                };
                
                // Add method to update RTC based on real elapsed time
                this.updateRTC = function() {
                    // Skip update if clock is halted
                    if (this.rtcRegisters.control & 0x40) return;
                    
                    const now = Date.now();
                    const elapsed = Math.floor((now - this.rtcRegisters.lastUpdate) / 1000);
                    
                    if (elapsed <= 0) return;
                    
                    // Update RTC registers
                    this.rtcRegisters.lastUpdate = now;
                    
                    // Calculate new time values
                    this.rtcRegisters.seconds += elapsed % 60;
                    if (this.rtcRegisters.seconds >= 60) {
                        this.rtcRegisters.seconds -= 60;
                        this.rtcRegisters.minutes++;
                    }
                    
                    this.rtcRegisters.minutes += Math.floor(elapsed / 60) % 60;
                    if (this.rtcRegisters.minutes >= 60) {
                        this.rtcRegisters.minutes -= 60;
                        this.rtcRegisters.hours++;
                    }
                    
                    this.rtcRegisters.hours += Math.floor(elapsed / 3600) % 24;
                    if (this.rtcRegisters.hours >= 24) {
                        this.rtcRegisters.hours -= 24;
                        this.rtcRegisters.days++;
                    }
                    
                    this.rtcRegisters.days += Math.floor(elapsed / 86400);
                    
                    // Handle overflow (512 days)
                    if (this.rtcRegisters.days > 511) {
                        this.rtcRegisters.days &= 0x1FF;
                        this.rtcRegisters.control |= 0x80; // Set overflow bit
                    }
                };
            }
        }
    };
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