export default class AudioController {
    constructor() {
        this.audioContext = null;
        this.audioElement = null;
        this.audioSource = null;
        this.panner = null;      
        this.gainNode = null;
        this.filterNode = null;
        this.initialized = false;
        this.isPlaying = false;
        this.filterEnabled = false;
        
        this.listenerPosition = [0, 0, 0];
        
        this.soundPosition = [0, 0, -5];
    }
    
    async init() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            this.audioElement = document.createElement('audio');
            this.audioElement.loop = true;
            
            this.audioSource = this.audioContext.createMediaElementSource(this.audioElement);
            
            this.panner = this.audioContext.createPanner();
            this.panner.panningModel = 'HRTF'; 
            this.panner.distanceModel = 'inverse';
            this.panner.refDistance = 1;
            this.panner.maxDistance = 10000;
            this.panner.rolloffFactor = 1;
            this.panner.coneInnerAngle = 360;
            this.panner.coneOuterAngle = 360;
            this.panner.coneOuterGain = 0;
            
            this.gainNode = this.audioContext.createGain();
            this.gainNode.gain.value = 0.8;
            
            this.filterNode = this.audioContext.createBiquadFilter();
            this.filterNode.type = 'peaking';
            this.filterNode.frequency.value = 1000; 
            this.filterNode.Q.value = 4.0;          
            this.filterNode.gain.value = 15;        
            
            this.audioSource.connect(this.gainNode);
            this.gainNode.connect(this.panner);
            
            this.panner.connect(this.audioContext.destination);
            
            this.setupListener();
            
            this.panner.setPosition(...this.soundPosition);
            
            this.initialized = true;
            console.log("Аудио система инициализирована успешно");
            
            return true;
        } catch (error) {
            console.error("Ошибка инициализации аудио системы:", error);
            return false;
        }
    }
    
    setupListener() {
        if (!this.audioContext || !this.audioContext.listener) return;
        
        if (this.audioContext.listener.positionX) {
            this.audioContext.listener.positionX.value = this.listenerPosition[0];
            this.audioContext.listener.positionY.value = this.listenerPosition[1];
            this.audioContext.listener.positionZ.value = this.listenerPosition[2];
            this.audioContext.listener.forwardX.value = 0;
            this.audioContext.listener.forwardY.value = 0;
            this.audioContext.listener.forwardZ.value = -1;
            this.audioContext.listener.upX.value = 0;
            this.audioContext.listener.upY.value = 1;
            this.audioContext.listener.upZ.value = 0;
        } else {
            this.audioContext.listener.setPosition(...this.listenerPosition);
            this.audioContext.listener.setOrientation(0, 0, -1, 0, 1, 0);
        }
    }
    
    async loadAudio(url) {
        if (!this.initialized) {
            await this.init();
        }
        
        if (this.isPlaying) {
            this.audioElement.pause();
            this.isPlaying = false;
        }
        
        try {
            const loadPromise = new Promise((resolve, reject) => {
                this.audioElement.addEventListener('canplaythrough', resolve, { once: true });
                this.audioElement.addEventListener('error', reject, { once: true });
            });
            
            this.audioElement.src = url;
            await this.audioElement.load();
            await loadPromise;
            
            console.log("Аудио загружено успешно:", url);
            return true;
        } catch (error) {
            console.error("Ошибка загрузки аудио:", error);
            return false;
        }
    }
    
    togglePlayback() {
        if (!this.initialized) {
            console.error("Аудио система не инициализирована");
            return false;
        }
        
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
        
        if (this.audioElement.readyState < 2) { 
            console.log("Аудио еще не готово, ожидание...");
            this.audioElement.addEventListener('canplay', () => {
                this.isPlaying = true;
                this.audioElement.play().catch(err => console.error("Ошибка воспроизведения:", err));
            }, { once: true });
            return this.isPlaying;
        }
        
        if (this.isPlaying) {
            this.audioElement.pause();
            this.isPlaying = false;
        } else {
            this.audioElement.play()
                .then(() => {
                    this.isPlaying = true;
                })
                .catch(err => {
                    console.error("Ошибка воспроизведения аудио:", err);
                    this.isPlaying = false;
                });
        }
        
        return this.isPlaying;
    }

    setSoundPosition(x, y, z) {
        if (!this.initialized || !this.panner) return;
        
        this.soundPosition = [x, y, z];
        
        if (this.panner.positionX) {
            this.panner.positionX.value = x;
            this.panner.positionY.value = y;
            this.panner.positionZ.value = z;
        } else {
            this.panner.setPosition(x, y, z);
        }
    }
    
    setSoundOrientation(x, y, z) {
        if (!this.initialized || !this.panner) return;
        
        if (this.panner.orientationX) {
            this.panner.orientationX.value = x;
            this.panner.orientationY.value = y;
            this.panner.orientationZ.value = z;
        } else {
            this.panner.setOrientation(x, y, z);
        }
    }
    
    toggleFilter(enabled) {
        if (!this.initialized) return;
        
        this.gainNode.disconnect();
        
        if (enabled) {
            this.gainNode.connect(this.filterNode);
            this.filterNode.connect(this.panner);
            this.filterEnabled = true;
        } else {
            this.gainNode.connect(this.panner);
            this.filterEnabled = false;
        }
    }
    
    updateFilterParams(frequency, Q, gain) {
        if (!this.initialized || !this.filterNode) return;
        
        this.filterNode.frequency.value = frequency || this.filterNode.frequency.value;
        this.filterNode.Q.value = Q || this.filterNode.Q.value;
        this.filterNode.gain.value = gain || this.filterNode.gain.value;
    }
    
    setVolume(level) {
        if (!this.initialized || !this.gainNode) return;
        
        this.gainNode.gain.value = Math.max(0, Math.min(1, level));
    }
    
    dispose() {
        if (this.audioElement) {
            this.audioElement.pause();
            this.audioElement.src = '';
        }
        
        if (this.audioContext) {
            this.audioContext.close();
        }
        
        this.initialized = false;
        this.isPlaying = false;
    }
}