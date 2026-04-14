import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { useMode } from './context/ModeContext';

// No top-level globals here to avoid race conditions with CDN scripts

const DWELL_TIME_MS = 2500;           // Keyboard cursor dwell: 2.5s to type
const HEAVY_DWELL_MS = 5000;          // BACKSPACE dwell: 5s (safety)
const WARNING_MS = 2000;
const BLINK_THRESHOLD = 0.25;
const HISTORY_CLEAR_BLINK_MS = 4000;  // 4s both-eye blink to clear history
const CIRCUMFERENCE = 2 * Math.PI * 17; // SVG keyboard-cursor progress ring (r=17)
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const MORSE_DICT: Record<string, string> = {
  '.-': 'A', '-...': 'B', '-.-.': 'C', '-..': 'D', '.': 'E',
  '..-.': 'F', '--.': 'G', '....': 'H', '..': 'I', '.---': 'J',
  '-.-': 'K', '.-..': 'L', '--': 'M', '-.': 'N', '---': 'O',
  '.--.': 'P', '--.-': 'Q', '.-.': 'R', '...': 'S', '-': 'T',
  '..-': 'U', '...-': 'V', '.--': 'W', '-..-': 'X', '-.--': 'Y',
  '--..': 'Z',
  '.----': '1', '..---': '2', '...--': '3', '....-': '4', '.....': '5',
  '-....': '6', '--...': '7', '---..': '8', '----.': '9', '-----': '0'
};

function isPrefix(seq: string) {
  for (const k in MORSE_DICT) {
    if (k.startsWith(seq) && k !== seq) return true;
  }
  return false;
}

const THEMES = {
  Light: { bg: '#f1f5f9', glass: 'rgba(255, 255, 255, 0.7)', border: 'rgba(0, 0, 0, 0.1)', text: '#0f172a', accent: '#0284c7' },
  Dark: { bg: '#0f172a', glass: 'rgba(30, 41, 59, 0.7)', border: 'rgba(255, 255, 255, 0.1)', text: '#f8fafc', accent: '#38bdf8' },
  PitchBlack: { bg: '#000000', glass: 'rgba(10, 10, 10, 0.8)', border: 'rgba(255, 255, 255, 0.05)', text: '#ffffff', accent: '#9333ea' },
  CrimsonRed: { bg: '#450a0a', glass: 'rgba(127, 29, 29, 0.6)', border: 'rgba(255, 255, 255, 0.1)', text: '#fecaca', accent: '#ef4444' },
  Pink: { bg: '#831843', glass: 'rgba(190, 24, 93, 0.6)', border: 'rgba(255, 255, 255, 0.2)', text: '#fbcfe8', accent: '#f43f5e' },
  Aqua: { bg: '#083344', glass: 'rgba(21, 94, 117, 0.6)', border: 'rgba(255, 255, 255, 0.1)', text: '#cffafe', accent: '#06b6d4' },
  Purple: { bg: '#3b0764', glass: 'rgba(88, 28, 135, 0.6)', border: 'rgba(255, 255, 255, 0.1)', text: '#f3e8ff', accent: '#c084fc' }
};

function App() {
  const { mode, landmarks, blinkStatus: globalBlink } = useMode();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const keyboardCursorRef = useRef<HTMLDivElement>(null);
  const keyboardCursorCircleRef = useRef<SVGCircleElement>(null);
  const frameCountRef = useRef(0);
  const calibSamplesRef = useRef<{x: number, y: number}[]>([]);

  const [hasStarted, setHasStarted] = useState(false);
  const [tier] = useState("REGISTERED");
  const [token] = useState("REGISTERED");

  const [typedText, setTypedText] = useState('');
  const [predictions, setPredictions] = useState<string[]>([]);
  const [hoverBtn, setHoverBtn] = useState<HTMLElement | null>(null);
  const [theme, setTheme] = useState<keyof typeof THEMES>('Dark');
  const [cameraStatus, setCameraStatus] = useState('Off');
  const [distanceCm, setDistanceCm] = useState(0);
  const [calibPhase, setCalibPhase] = useState<'idle' | 'calibrating' | 'done'>('idle');
  const [calibProgress, setCalibProgress] = useState(0);
  const [calibWarning, setCalibWarning] = useState('');
  const [calibBaselineX, setCalibBaselineX] = useState(0.5);
  const [calibBaselineY, setCalibBaselineY] = useState(0);

  const [inputMode, setInputMode] = useState<'standard' | 'morse'>('standard');
  const [morseSequence, setMorseSequence] = useState<string>('');
  const [blinkStatus, setBlinkStatus] = useState<'idle' | 'dot' | 'dash' | 'mega' | 'clear' | 'reset'>('idle');

  // Sync global blink for Morse/Selection
  useEffect(() => {
    if (mode === 'gaze' && inputMode === 'morse' && globalBlink === 'dot') {
      triggerMorseSymbol('.');
    }
  }, [globalBlink, inputMode, mode]);

  const stateRef = useRef({
    typedText: '',
    token: 'GUEST',
    hoverBtn: null as HTMLElement | null,
    hoverStart: 0,
    smoothX: window.innerWidth / 2,
    smoothY: window.innerHeight / 2,
    gyroOffsetX: 0,
    gyroOffsetY: 0,
    blinkDurationStart: 0,
    hasWarned: false,
    lastBlinkEnd: 0,
    inputMode: 'standard',
    morseSequence: '',
    predictions: [] as string[],
    tiltFired: false,
    shakeCooldown: 0,
    touchStart: 0,
    lastWinkTime: 0,
    bothBlinkStart: 0,
    historyResetFired: false,
    // ── Calibration state ─────────────────────────────────
    calibPhase: 'idle' as 'idle' | 'calibrating' | 'done',
    calibStartTime: 0,
    // ── Keyboard-specific gaze state (normal mode, fully independent) ───────────────
    keySmX: 0,
    keySmY: 0,
    keyHoverBtn: null as HTMLElement | null,
    keyHoverStart: 0,
    hasKeyWarned: false,
    isDesktop: window.innerWidth >= 768 && window.innerHeight < window.innerWidth,
  });

  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 768 && window.innerHeight < window.innerWidth);

  useEffect(() => {
    const handleResize = () => {
      const desktop = window.innerWidth >= 768 && window.innerHeight < window.innerWidth;
      setIsDesktop(desktop);
      stateRef.current.isDesktop = desktop;
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    stateRef.current.typedText = typedText;
    stateRef.current.token = token;
    stateRef.current.inputMode = inputMode;
    stateRef.current.morseSequence = morseSequence;
    stateRef.current.predictions = predictions;
    stateRef.current.calibPhase = calibPhase;
  }, [typedText, token, inputMode, morseSequence, predictions, calibPhase]);

  const applyTheme = (tName: keyof typeof THEMES) => {
    setTheme(tName);
    const t = THEMES[tName];
    const root = document.documentElement;
    root.style.setProperty('--bg-color', t.bg);
    root.style.setProperty('--glass-bg', t.glass);
    root.style.setProperty('--glass-border', t.border);
    root.style.setProperty('--text-primary', t.text);
    root.style.setProperty('--accent-color', t.accent);
  };

  const speakText = (text: string) => {
    if (!window.speechSynthesis) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.3;
    window.speechSynthesis.speak(utterance);
  };

  const getPreviousWord = (str: string) => {
    const words = str.trim().split(' ');
    if (str.endsWith(' ')) {
      return words.length > 0 ? words[words.length - 1] : "START";
    }
    return words.length > 1 ? words[words.length - 2] : "START";
  };

  const logWord = async (currWord: string) => {
    const prevWord = getPreviousWord(stateRef.current.typedText);
    try {
      await axios.post(`${API_BASE}/log`, { prev_word: prevWord, current_word: currWord });
    } catch (e) {
      console.error(e);
    }
  };

  const fetchPredictions = async (prefix: string) => {
    const prevWord = getPreviousWord(stateRef.current.typedText);
    try {
      const res = await axios.get(`${API_BASE}/predict?prev_word=${prevWord}&prefix=${prefix}&token=${stateRef.current.token}`);
      setPredictions(res.data.suggestions);
    } catch (e) {
      console.error(e);
    }
  };

  const executeAction = async (actionId: string) => {
    const currentText = stateRef.current.typedText.trim();
    
    if (actionId === 'COPY') {
      try {
        await navigator.clipboard.writeText(currentText);
        speakText("Copied to clipboard");
      } catch(e) { speakText("Copy Failed"); }
    } 
    else if (actionId === 'WHATSAPP') {
      speakText("Opening WhatsApp");
      window.open(`whatsapp://send?text=${encodeURIComponent(currentText)}`, '_blank');
    }
    else if (actionId === 'ASK AI') {
      speakText("Thinking");
      setTypedText(currentText + "\n[Thinking...]");
      try {
        const res = await axios.post(`${API_BASE}/chat_ai`, { text: currentText, token: stateRef.current.token });
        const answer = res.data.response;
        setTypedText(currentText + `\n[AI]: ${answer}\n`);
        speakText(answer);
      } catch(e) {
        setTypedText(currentText + "\n[AI Server Offline]\n");
        speakText("AI Server Offline");
      }
    }
    else if (actionId === 'RESET_HISTORY') {
      // Clear typed text on screen
      setTypedText('');
      setPredictions([]);
      stateRef.current.typedText = '';
      stateRef.current.predictions = [];
      speakText("History cleared");
      // Reset backend N-Gram model
      try {
        await axios.post(`${API_BASE}/reset`);
      } catch(e) {
        console.error('Reset failed', e);
      }
    }
  }

  const handleKeyPress = (letter: string) => {
    let newStr = stateRef.current.typedText;
    
    if (['COPY', 'WHATSAPP', 'ASK AI'].includes(letter)) {
       executeAction(letter);
       return;
    }

    if (letter === 'SPACE') {
      const words = newStr.split(' ');
      const lastWord = words[words.length - 1];
      if (lastWord.length > 0) logWord(lastWord);
      newStr += ' ';
      speakText("Space");
    } else if (letter === 'CLEAR') {
      const words = newStr.trim().split(' ');
      words.pop();
      newStr = words.join(' ') + (words.length > 0 ? ' ' : '');
      speakText("Cleared Word");
    } else if (letter === 'BACKSPACE') {
      newStr = '';
      speakText("DELETED ALL");
    } else {
      newStr += letter;
      speakText(letter);
    }
    
    setTypedText(newStr);
    const words = newStr.split(' ');
    fetchPredictions(words[words.length - 1]);
  };

  const selectPrediction = (word: string) => {
    // Logic to select prediction
    if (!word) return;
    const words = typedText.trim().split(' ');
    words[words.length - 1] = word;
    const newText = words.join(' ') + ' ';
    setTypedText(newText);
    stateRef.current.typedText = newText;
    fetchPredictions(newText);
  };

  const startEngine = async () => {
    setHasStarted(true);

    // FORCE CAMERA PERMISSION PROMPT (The Kickstarter)
    try {
        await navigator.mediaDevices.getUserMedia({ video: true });
    } catch(err) {
        alert("Camera Access Denied. Please click the Camera icon in your browser address bar and select 'Allow' to use EyeType.");
        setHasStarted(false);
        return;
    }

    if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
      try {
        const permissionState = await (DeviceOrientationEvent as any).requestPermission();
        if (permissionState === 'granted') {
          window.addEventListener('deviceorientation', handleGyro, true);
          window.addEventListener('devicemotion', handleMotion, true);
        }
      } catch(e) { console.error(e); }
    } else {
      window.addEventListener('deviceorientation', handleGyro, true);
      window.addEventListener('devicemotion', handleMotion, true);
    }

    // Start calibration phase
    setCalibPhase('calibrating');
    stateRef.current.calibPhase = 'calibrating';
    stateRef.current.calibStartTime = Date.now();
    calibSamplesRef.current = [];
    setCalibProgress(0);
    setCalibWarning('');

    // No local initCamera needed, GlobalGazeSystem handles it
    fetchPredictions('');
  };

  const handleMotion = (event: DeviceMotionEvent) => {
     if (stateRef.current.inputMode !== 'morse') return;
     const acc = event.accelerationIncludingGravity;
     if (!acc || !acc.x || !acc.y || !acc.z) return;
     
     const magnitude = Math.sqrt(acc.x*acc.x + acc.y*acc.y + acc.z*acc.z);
     const now = Date.now();
     if (magnitude > 25 && now - stateRef.current.shakeCooldown > 2000) {
         stateRef.current.shakeCooldown = now;
         handleKeyPress('CLEAR');
         setBlinkStatus('clear');
         setTimeout(() => setBlinkStatus('idle'), 1000);
     }
  };

  const handleGyro = (event: DeviceOrientationEvent) => {
    if (event.gamma && event.beta) {
      if (stateRef.current.inputMode === 'morse') {
          const tilt = event.gamma;
          if (!stateRef.current.tiltFired) {
              if (tilt < -35) {
                  triggerMorseSymbol('.');
              } else if (tilt > 35) {
                  triggerMorseSymbol('-');
              }
          } else if (Math.abs(tilt) < 15) {
              stateRef.current.tiltFired = false;
          }
      } else {
          stateRef.current.gyroOffsetX = event.gamma * 2.0; 
          stateRef.current.gyroOffsetY = (event.beta - 45) * 2.0; 
      }
    }
  };

  const triggerMorseSymbol = (symbol: '-' | '.') => {
      stateRef.current.lastBlinkEnd = Date.now();
      stateRef.current.tiltFired = true; 
      
      setBlinkStatus(symbol === '-' ? 'dash' : 'dot');
      setTimeout(() => setBlinkStatus('idle'), 300);

      const newSeq = stateRef.current.morseSequence + symbol;
      setMorseSequence(newSeq);
      stateRef.current.morseSequence = newSeq;
      
      if (!isPrefix(newSeq) && MORSE_DICT[newSeq]) {
          handleKeyPress(MORSE_DICT[newSeq]);
          setMorseSequence('');
      }
  };

  const processMorseDuration = (duration: number) => {
      setBlinkStatus('idle');
      stateRef.current.lastBlinkEnd = Date.now();

      if (duration > 2000) {
          handleKeyPress('CLEAR');
      }
      else if (duration > 800) {
          if (stateRef.current.predictions.length > 0) {
              selectPrediction(stateRef.current.predictions[0]);
          } else {
              handleKeyPress('SPACE');
          }
          setMorseSequence('');
      } 
      else if (duration > 50) {
          let symbol: '-' | '.' = duration >= 300 ? '-' : '.';
          
          if (duration >= 200 && duration <= 350) {
              const preds = stateRef.current.predictions;
              if (preds.length > 0) {
                  const words = stateRef.current.typedText.trim().split(' ');
                  const chunk = words[words.length - 1] || '';
                  const pred = preds[0];
                  if (pred.toLowerCase().startsWith(chunk.toLowerCase())) {
                      const expChar = pred[chunk.length]?.toUpperCase();
                      if (expChar) {
                          const expMorse = Object.keys(MORSE_DICT).find(k => MORSE_DICT[k] === expChar);
                          if (expMorse) {
                              const seq = stateRef.current.morseSequence;
                              if (expMorse.startsWith(seq + '.')) {
                                  symbol = '.';
                              } else if (expMorse.startsWith(seq + '-')) {
                                  symbol = '-';
                              }
                          }
                      }
                  }
              }
          }
          triggerMorseSymbol(symbol);
      }
  };

  // Use global gaze data instead of local camera
  useEffect(() => {
    if (mode === 'gaze' && landmarks.length > 0) {
      if (cameraStatus !== 'Live') setCameraStatus('Live');
      onResults({ multiFaceLandmarks: [landmarks], image: null });
    } else {
      setCameraStatus('Off');
    }
  }, [landmarks, mode]);

  const onResults = (results: any) => {
    // ... logic to draw local canvas if needed, but primarily process gaze
    const canvas = canvasRef.current;
    if (!canvas) return; const ctx = canvas.getContext('2d'); if (!ctx) return;

    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (!results || !results.image) {
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
        return;
    }

    if (cameraStatus !== 'Live') setCameraStatus('Live');
    
    // Draw landmarks only if needed, focus on processing data
    // ctx.translate(canvas.width, 0); ctx.scale(-1, 1);
    // ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

    const drawConnectors = (window as any).drawConnectors;
    const FACEMESH_TESSELATION = (window as any).FACEMESH_TESSELATION;
    const FACEMESH_FACE_OVAL = (window as any).FACEMESH_FACE_OVAL;
    const FACEMESH_RIGHT_EYE = (window as any).FACEMESH_RIGHT_EYE;
    const FACEMESH_LEFT_EYE = (window as any).FACEMESH_LEFT_EYE;

    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
      const landmarks = results.multiFaceLandmarks[0];

      // ── CALIBRATION PHASE: collect baseline iris samples ──────────────────
      if (stateRef.current.calibPhase === 'calibrating') {
        const elapsed = Date.now() - stateRef.current.calibStartTime;
        const CALIB_DURATION = 3000; // 3 seconds

        // Compute current iris center relative to eye (same formula as updateKeyboardGaze)
        const rIX = (landmarks[468].x + landmarks[469].x + landmarks[470].x + landmarks[471].x + landmarks[472].x) / 5;
        const lIX = (landmarks[473].x + landmarks[474].x + landmarks[475].x + landmarks[476].x + landmarks[477].x) / 5;
        const rIY = (landmarks[468].y + landmarks[469].y + landmarks[470].y + landmarks[471].y + landmarks[472].y) / 5;
        const lIY = (landmarks[473].y + landmarks[474].y + landmarks[475].y + landmarks[476].y + landmarks[477].y) / 5;

        const rEL = Math.min(landmarks[33].x, landmarks[133].x);
        const rER = Math.max(landmarks[33].x, landmarks[133].x);
        const lEL = Math.min(landmarks[263].x, landmarks[362].x);
        const lER = Math.max(landmarks[263].x, landmarks[362].x);
        const rW = (rER - rEL) || 0.001;
        const lW = (lER - lEL) || 0.001;
        const normX = 1.0 - ((rIX - rEL) / rW + (lIX - lEL) / lW) / 2;

        const rMY = (landmarks[159].y + landmarks[145].y) / 2;
        const lMY = (landmarks[386].y + landmarks[374].y) / 2;
        const rEH = Math.abs(landmarks[145].y - landmarks[159].y) || 0.001;
        const lEH = Math.abs(landmarks[374].y - landmarks[386].y) || 0.001;
        const normY = ((rIY - rMY) / (rEH * 0.5) + (lIY - lMY) / (lEH * 0.5)) / 2;

        // Check if user is looking roughly at camera (face centerish)
        const nose = landmarks[4]; // tip of nose
        const faceIsCenter = nose.x > 0.25 && nose.x < 0.75 && nose.y > 0.25 && nose.y < 0.75;
        // Check iris isn't wildly off-center (should be near 0.5 normalized)
        const irisIsCenter = normX > 0.35 && normX < 0.65;

        if (!faceIsCenter || !irisIsCenter) {
          setCalibWarning('👁️ Please look directly at the camera to calibrate');
          // Don't collect this sample — user is looking away
        } else {
          setCalibWarning('');
          calibSamplesRef.current.push({ x: normX, y: normY });
        }

        setCalibProgress(Math.min(100, (elapsed / CALIB_DURATION) * 100));

        // Draw calibration crosshair on canvas
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform for overlay
        const cxc = canvas.width / 2, cyc = canvas.height / 2;
        ctx.strokeStyle = irisIsCenter && faceIsCenter ? '#10b981' : '#ef4444';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(cxc - 30, cyc); ctx.lineTo(cxc + 30, cyc); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cxc, cyc - 30); ctx.lineTo(cxc, cyc + 30); ctx.stroke();
        ctx.beginPath(); ctx.arc(cxc, cyc, 20, 0, 2 * Math.PI); ctx.stroke();
        ctx.restore();

        if (elapsed >= CALIB_DURATION) {
          const samples = calibSamplesRef.current;
          if (samples.length >= 10) {
            // Compute median (more robust than mean against outliers)
            const sortedX = samples.map(s => s.x).sort((a,b) => a - b);
            const sortedY = samples.map(s => s.y).sort((a,b) => a - b);
            const medX = sortedX[Math.floor(sortedX.length / 2)];
            const medY = sortedY[Math.floor(sortedY.length / 2)];
            setCalibBaselineX(medX);
            setCalibBaselineY(medY);
            setCalibPhase('done');
            setCalibWarning('');
            speakText('Calibration complete. Start typing.');
          } else {
            // Not enough good samples — restart
            setCalibWarning('⚠️ Could not calibrate — keep your eyes on the camera. Retrying...');
            stateRef.current.calibStartTime = Date.now();
            calibSamplesRef.current = [];
            setCalibProgress(0);
          }
        }

        // During calibration, still draw the face but skip all keyboard/blink logic
        if (drawConnectors && FACEMESH_FACE_OVAL) {
          drawConnectors(ctx, landmarks, FACEMESH_FACE_OVAL, { color: '#E0E0E0', lineWidth: 1 });
        }
        ctx.restore();
        return;
      }
      // DRAW FULL DIGITAL FACE MESH
      if (drawConnectors) {
        drawConnectors(ctx, landmarks, FACEMESH_TESSELATION, { color: 'rgba(56, 189, 248, 0.1)', lineWidth: 0.5 });
        drawConnectors(ctx, landmarks, FACEMESH_FACE_OVAL, { color: 'rgba(56, 189, 248, 0.4)', lineWidth: 1 });
        drawConnectors(ctx, landmarks, FACEMESH_RIGHT_EYE, { color: 'rgba(56, 189, 248, 0.6)', lineWidth: 1 });
        drawConnectors(ctx, landmarks, FACEMESH_LEFT_EYE, { color: 'rgba(56, 189, 248, 0.6)', lineWidth: 1 });
      }
      
      // DRAW OCTAGON PATTERN ON EACH EYE + NOSE TIP ANCHOR
      const drawOctagon = (cx: number, cy: number, radius: number, color: string) => {
        for (let i = 0; i < 8; i++) {
          const angle = (i / 8) * 2 * Math.PI - Math.PI / 8;
          const px = cx + radius * Math.cos(angle);
          const py = cy + radius * Math.sin(angle);
          ctx.beginPath();
          ctx.arc(px, py, 1.5, 0, 2 * Math.PI);
          ctx.fillStyle = color;
          ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,0.8)';
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
        // Center dot
        ctx.beginPath();
        ctx.arc(cx, cy, 2, 0, 2 * Math.PI);
        ctx.fillStyle = '#fff';
        ctx.fill();
      };

      // Right iris octagon (center: landmark 468)
      const rIris = landmarks[468];
      const rCorner = landmarks[33];
      const rCorner2 = landmarks[133];
      const irisRadius = Math.abs(rCorner.x - rCorner2.x) * canvas.width * 0.04;
      drawOctagon(rIris.x * canvas.width, rIris.y * canvas.height, irisRadius, '#10b981');

      // Left iris octagon (center: landmark 473)
      const lIris = landmarks[473];
      drawOctagon(lIris.x * canvas.width, lIris.y * canvas.height, irisRadius, '#10b981');

      // Nose tip anchor point (landmark 4) - improves depth accuracy
      const nose = landmarks[4];
      ctx.beginPath();
      ctx.arc(nose.x * canvas.width, nose.y * canvas.height, 3, 0, 2 * Math.PI);
      ctx.fillStyle = '#f59e0b';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.stroke();

      // ── DISTANCE ESTIMATION (using inter-eye pixel width) ──────────────────
      // Known avg. inner-to-outer eye corner distance ≈ 33 mm; focal ≈ 600 px
      const eyeWidthPx = Math.abs(rCorner.x - rCorner2.x) * canvas.width;
      if (eyeWidthPx > 5) {
        frameCountRef.current++;
        if (frameCountRef.current % 20 === 0) {
          const estimated = Math.round((600 * 33) / (eyeWidthPx * 10));
          setDistanceCm(Math.max(20, Math.min(200, estimated)));
        }
      }

      const earR = Math.abs(landmarks[159].y - landmarks[145].y) / Math.abs(landmarks[33].x - landmarks[133].x);
      const earL = Math.abs(landmarks[386].y - landmarks[374].y) / Math.abs(landmarks[362].x - landmarks[263].x);
      // Both eyes closed: average EAR below threshold AND neither is a wink
      const isWinkR = earR < BLINK_THRESHOLD && earL > (BLINK_THRESHOLD * 2);
      const isWinkL = earL < BLINK_THRESHOLD && earR > (BLINK_THRESHOLD * 2);
      const bothEyesClosed = earR < BLINK_THRESHOLD && earL < BLINK_THRESHOLD;
      const isBlinking = bothEyesClosed; // full blink = both eyes
      const now = Date.now();

      // ── 4-SECOND BOTH-EYE BLINK → CLEAR HISTORY ──────────────────────────
      if (bothEyesClosed) {
        if (stateRef.current.bothBlinkStart === 0) stateRef.current.bothBlinkStart = now;
        const held = now - stateRef.current.bothBlinkStart;
        if (held >= HISTORY_CLEAR_BLINK_MS && !stateRef.current.historyResetFired) {
          stateRef.current.historyResetFired = true;
          setBlinkStatus('reset');
          executeAction('RESET_HISTORY');
          setTimeout(() => setBlinkStatus('idle'), 1500);
        } else if (!stateRef.current.historyResetFired) {
          // Show charging progress in blink widget
          if (held > 2000) setBlinkStatus('reset');
          else if (held > 800) setBlinkStatus('clear');
        }
      } else {
        // Eyes opened — reset the 4s counter
        stateRef.current.bothBlinkStart = 0;
        stateRef.current.historyResetFired = false;
      }

      if (isBlinking) {
        if (stateRef.current.blinkDurationStart === 0) stateRef.current.blinkDurationStart = now;
        
        const currentDuration = now - stateRef.current.blinkDurationStart;
        if (stateRef.current.inputMode === 'morse') {
            if (currentDuration > 2000) setBlinkStatus('clear');
            else if (currentDuration > 800) setBlinkStatus('mega');
            else if (currentDuration > 250) setBlinkStatus('dash');
            else setBlinkStatus('dot');
        }
      } else {
        // Eyes fully opened — evaluate completed blink
        if (stateRef.current.blinkDurationStart > 0) {
          const duration = now - stateRef.current.blinkDurationStart;
          stateRef.current.blinkDurationStart = 0;

          // Ignore very short noise (< 60ms) to prevent ghost typing from ambient light
          if (duration < 60) {
            // do nothing, too short to be intentional
          } else if (stateRef.current.inputMode === 'standard') {
            if (duration < 350 && duration >= 60) {
              // Short deliberate blink → type the hovered key
              if (stateRef.current.hoverBtn) {
                const letter = stateRef.current.hoverBtn.getAttribute('data-letter');
                if (letter) handleKeyPress(letter);
              }
            } else if (duration >= 350 && duration < HISTORY_CLEAR_BLINK_MS) {
              // Medium-long blink → Space
              handleKeyPress('SPACE');
            }
            // Very long blink (>= 4s) is handled by the 4s reset logic above
          } else {
            // Morse mode blink
            if (duration < HISTORY_CLEAR_BLINK_MS) processMorseDuration(duration);
          }
          setBlinkStatus('idle');
        } else if (stateRef.current.inputMode === 'morse' && stateRef.current.morseSequence.length > 0) {
            if (now - stateRef.current.lastBlinkEnd > 1000) {
                if (MORSE_DICT[stateRef.current.morseSequence]) {
                    handleKeyPress(MORSE_DICT[stateRef.current.morseSequence]);
                } else {
                    speakText("Invalid Morse");
                }
                setMorseSequence('');
            }
        }

        // ── ONE EYE WINK → CLEAR LAST WORD ──────────────────────────────────
        if ((isWinkR || isWinkL) && now - stateRef.current.lastWinkTime > 1500) {
            stateRef.current.lastWinkTime = now;
            handleKeyPress('CLEAR');
            setBlinkStatus('clear');
            setTimeout(() => setBlinkStatus('idle'), 1000);
        }
      }

      // PRECISION GAZE CALCULATION (Using Dual Eye Average)
      const sW = landmarks[133].x - landmarks[33].x;
      const sH = landmarks[145].y - landmarks[159].y;
      
      if (sW > 0 && sH > 0) {
        // Average the position of both irises for rock-solid stability
        const irisX = (landmarks[468].x + landmarks[473].x) / 2;
        const irisY = (landmarks[468].y + landmarks[473].y) / 2;

        const normX = 1.0 - ((irisX - landmarks[33].x) / sW);
        const normY = (irisY - landmarks[159].y) / sH;

        // Increased sensitivity range (0.4 / 0.2 instead of 0.35 / 0.3)
        const mX = Math.max(0, Math.min(1, (normX - 0.4) / 0.2));
        const mY = Math.max(0, Math.min(1, (normY - 0.4) / 0.2));

        const targetX = (mX * window.innerWidth) + stateRef.current.gyroOffsetX;
        const targetY = (mY * window.innerHeight) + stateRef.current.gyroOffsetY;
        
        const dx = targetX - stateRef.current.smoothX;
        const dy = targetY - stateRef.current.smoothY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const dynamicAlpha = Math.min(0.7, Math.max(0.03, dist / 300.0));

        stateRef.current.smoothX += dynamicAlpha * dx;
        stateRef.current.smoothY += dynamicAlpha * dy;

        if (cursorRef.current) {
          cursorRef.current.style.left = `${stateRef.current.smoothX}px`;
          cursorRef.current.style.top = `${stateRef.current.smoothY}px`;
        }

        // Hide global gaze-cursor when inside keyboard or camera area
        if (cursorRef.current) {
          const kEl = document.getElementById('keyboard-area');
          const cEl = document.querySelector('.camera-container') as HTMLElement | null;
          let hideGlobal = false;
          if (kEl) {
            const kr = kEl.getBoundingClientRect();
            if (stateRef.current.smoothX >= kr.left && stateRef.current.smoothX <= kr.right &&
                stateRef.current.smoothY >= kr.top  && stateRef.current.smoothY <= kr.bottom) hideGlobal = true;
          }
          if (cEl) {
            const cr = cEl.getBoundingClientRect();
            if (stateRef.current.smoothX >= cr.left && stateRef.current.smoothX <= cr.right &&
                stateRef.current.smoothY >= cr.top  && stateRef.current.smoothY <= cr.bottom) hideGlobal = true;
          }
          cursorRef.current.style.opacity = hideGlobal ? '0' : '1';
        }

        checkIntersections();

        // High-sensitivity eye tracking for keyboard (normal mode only)
        if (stateRef.current.inputMode === 'standard') updateKeyboardGaze(landmarks);
        else if (keyboardCursorRef.current) keyboardCursorRef.current.style.display = 'none';
      }
    }
    ctx.restore();
  };

  // ── HIGH-SENSITIVITY KEYBOARD GAZE ENGINE (Normal Mode Only) ──────────────
  // Uses 5 iris ring points per eye for sub-pixel accuracy.
  // Maps the narrow iris travel range directly to keyboard coordinates
  // so even <1cm screen movements resolve to different keys.
  const updateKeyboardGaze = (landmarks: any[]) => {
    const keyboardArea = document.getElementById('keyboard-area');
    if (!keyboardArea || !keyboardCursorRef.current || !keyboardCursorCircleRef.current) return;

    // === STEP 1: MULTI-POINT IRIS CENTROID (5 pts each eye) ===
    // MediaPipe refine landmarks: 468-472 = right iris ring, 473-477 = left iris ring
    const rIrisX = (landmarks[468].x + landmarks[469].x + landmarks[470].x + landmarks[471].x + landmarks[472].x) / 5;
    const rIrisY = (landmarks[468].y + landmarks[469].y + landmarks[470].y + landmarks[471].y + landmarks[472].y) / 5;
    const lIrisX = (landmarks[473].x + landmarks[474].x + landmarks[475].x + landmarks[476].x + landmarks[477].x) / 5;
    const lIrisY = (landmarks[473].y + landmarks[474].y + landmarks[475].y + landmarks[476].y + landmarks[477].y) / 5;

    // === STEP 2: NORMALIZED IRIS POSITION WITHIN EACH EYE ===
    // Horizontal: iris x relative to eye corner span
    // Right eye corners: 33 (temporal/outer), 133 (nasal/inner)
    // Left eye corners: 263 (temporal/outer), 362 (nasal/inner)
    const rEyeLeft  = Math.min(landmarks[33].x,  landmarks[133].x);
    const rEyeRight = Math.max(landmarks[33].x,  landmarks[133].x);
    const lEyeLeft  = Math.min(landmarks[263].x, landmarks[362].x);
    const lEyeRight = Math.max(landmarks[263].x, landmarks[362].x);
    const rEyeW = (rEyeRight - rEyeLeft) || 0.001;
    const lEyeW = (lEyeRight - lEyeLeft) || 0.001;

    const rNormX = (rIrisX - rEyeLeft) / rEyeW; // 0=left corner, 1=right corner (image space)
    const lNormX = (lIrisX - lEyeLeft) / lEyeW;
    // Mirror x (canvas is flipped) and average both eyes
    const rawNormX = 1.0 - (rNormX + lNormX) / 2;

    // Vertical: iris Y relative to eyelid center
    // Upper eyelid: 159 (right), 386 (left) | Lower eyelid: 145 (right), 374 (left)
    const rEyeMidY = (landmarks[159].y + landmarks[145].y) / 2;
    const lEyeMidY = (landmarks[386].y + landmarks[374].y) / 2;
    const rEyeH = Math.abs(landmarks[145].y - landmarks[159].y) || 0.001;
    const lEyeH = Math.abs(landmarks[374].y - landmarks[386].y) || 0.001;
    // Signed offset from center (-=up, +=down), scaled by eye height
    const rNormY = (rIrisY - rEyeMidY) / (rEyeH * 0.5);
    const lNormY = (lIrisY - lEyeMidY) / (lEyeH * 0.5);
    const rawNormY = (rNormY + lNormY) / 2; // approx -1..1

    // === STEP 3: SUBTRACT CALIBRATION BASELINE → MAP TO KEYBOARD ===
    // calibBaselineX is the user's "looking at camera" normX (~0.5 ideally)
    // calibBaselineY is the user's "looking at camera" normY (~0.0 ideally)
    // We center the gaze around the baseline, then stretch to keyboard range
    const centeredX = rawNormX - calibBaselineX + 0.5; // recentered around 0.5
    const centeredY = rawNormY - calibBaselineY;        // recentered around 0

    const desktop = stateRef.current.isDesktop;
    const GAZE_X_MIN = desktop ? 0.22 : 0.28;
    const GAZE_X_MAX = desktop ? 0.78 : 0.72;
    const GAZE_Y_RANGE = 0.40;
    const mappedX = Math.max(0, Math.min(1, (centeredX - GAZE_X_MIN) / (GAZE_X_MAX - GAZE_X_MIN)));
    const mappedY = Math.max(0, Math.min(1, (centeredY + GAZE_Y_RANGE) / (2 * GAZE_Y_RANGE)));

    // === STEP 4: ADAPTIVE SMOOTHING ===
    // More responsive for larger jumps (intentional key changes),
    // more stable for small jitter (holding gaze)
    const kRect = keyboardArea.getBoundingClientRect();
    const targetKX = mappedX * kRect.width;
    const targetKY = mappedY * kRect.height;
    const dkx = targetKX - stateRef.current.keySmX;
    const dky = targetKY - stateRef.current.keySmY;
    const kdist = Math.sqrt(dkx * dkx + dky * dky);
    const alpha = Math.min(0.22, Math.max(0.06, kdist / 280));
    stateRef.current.keySmX += alpha * dkx;
    stateRef.current.keySmY += alpha * dky;

    // === STEP 5: UPDATE CURSOR POSITION ===
    // CSS `display: none` is initial state; JS update always wins here
    // because there is no React-controlled `display` prop on this element
    keyboardCursorRef.current.style.display = 'block';
    keyboardCursorRef.current.style.left = `${stateRef.current.keySmX}px`;
    keyboardCursorRef.current.style.top  = `${stateRef.current.keySmY}px`;

    // === STEP 6: HIT-TEST KEYBOARD BUTTONS ===
    const absX = kRect.left + stateRef.current.keySmX;
    const absY = kRect.top  + stateRef.current.keySmY;
    let hitBtn: HTMLElement | null = null;
    keyboardArea.querySelectorAll('.gaze-btn').forEach(b => {
      const r = (b as HTMLElement).getBoundingClientRect();
      if (absX >= r.left && absX <= r.right && absY >= r.top && absY <= r.bottom)
        hitBtn = b as HTMLElement;
    });
    const keyHit = hitBtn as HTMLElement | null; // explicit cast for TS

    // === STEP 7: DWELL TIMER → KEY FIRE ===
    if (keyHit) {
      if (stateRef.current.keyHoverBtn !== keyHit) {
        // New key — reset dwell timer
        if (stateRef.current.keyHoverBtn) {
          stateRef.current.keyHoverBtn.style.setProperty('--dwell-progress', '0%');
          stateRef.current.keyHoverBtn.style.backgroundColor = '';
          stateRef.current.keyHoverBtn.style.color = '';
        }
        stateRef.current.keyHoverBtn  = keyHit;
        stateRef.current.keyHoverStart = Date.now();
        stateRef.current.hasKeyWarned  = false;
        setHoverBtn(keyHit);
        keyboardCursorCircleRef.current.setAttribute('stroke-dashoffset', CIRCUMFERENCE.toFixed(2));
      } else {
        const letter   = keyHit.getAttribute('data-letter');
        const reqDwell = letter === 'BACKSPACE' ? HEAVY_DWELL_MS : DWELL_TIME_MS;
        const elapsed  = Date.now() - stateRef.current.keyHoverStart;
        const prog     = Math.min(100, (elapsed / reqDwell) * 100);
        const ringOff  = CIRCUMFERENCE - (prog / 100) * CIRCUMFERENCE;
        keyHit.style.setProperty('--dwell-progress', `${prog}%`);
        keyboardCursorCircleRef.current.setAttribute('stroke-dashoffset', ringOff.toFixed(2));

        if (letter === 'BACKSPACE' && elapsed > WARNING_MS) {
          keyHit.style.backgroundColor = 'rgba(239, 68, 68, 0.8)';
          keyHit.style.color = 'white';
          if (!stateRef.current.hasKeyWarned) { speakText('Warning, Deleting All'); stateRef.current.hasKeyWarned = true; }
        }

        if (prog >= 100) {
          if (letter) handleKeyPress(letter);
          stateRef.current.keyHoverStart = Date.now();
          keyHit.style.setProperty('--dwell-progress', '0%');
          keyHit.style.backgroundColor = '';
          keyHit.style.color = '';
          keyboardCursorCircleRef.current.setAttribute('stroke-dashoffset', CIRCUMFERENCE.toFixed(2));
          stateRef.current.hasKeyWarned = false;
        }
      }
    } else {
      if (stateRef.current.keyHoverBtn) {
        stateRef.current.keyHoverBtn.style.setProperty('--dwell-progress', '0%');
        stateRef.current.keyHoverBtn.style.backgroundColor = '';
        stateRef.current.keyHoverBtn.style.color = '';
        stateRef.current.keyHoverBtn = null;
        setHoverBtn(null);
      }
      keyboardCursorCircleRef.current.setAttribute('stroke-dashoffset', CIRCUMFERENCE.toFixed(2));
    }
  };

  // ── GLOBAL CURSOR HIT-TEST (suggestion bar, action buttons only) ─────────────
  // Keyboard buttons are excluded here — handled entirely by updateKeyboardGaze
  const checkIntersections = () => {
    let hitEl: HTMLElement | null = null;
    document.querySelectorAll('.gaze-btn').forEach(b => {
      // Skip keyboard area buttons — they are handled by updateKeyboardGaze
      if ((b as HTMLElement).closest('#keyboard-area')) return;
      const rect = (b as HTMLElement).getBoundingClientRect();
      if (stateRef.current.smoothX >= rect.left && stateRef.current.smoothX <= rect.right &&
          stateRef.current.smoothY >= rect.top  && stateRef.current.smoothY <= rect.bottom)
        hitEl = b as HTMLElement;
    });

    const hit = hitEl as HTMLElement | null;
    if (hit) {
      if (stateRef.current.hoverBtn !== hit) {
        if (stateRef.current.hoverBtn && !(stateRef.current.hoverBtn.closest('#keyboard-area'))) {
          stateRef.current.hoverBtn.style.setProperty('--dwell-progress', '0%');
          stateRef.current.hoverBtn.style.backgroundColor = '';
        }
        stateRef.current.hoverBtn = hit;
        setHoverBtn(hit);
        stateRef.current.hoverStart = Date.now();
      } else {
        const letter  = hit.getAttribute('data-letter');
        const elapsed = Date.now() - stateRef.current.hoverStart;
        const prog    = Math.min(100, (elapsed / DWELL_TIME_MS) * 100);
        hit.style.setProperty('--dwell-progress', `${prog}%`);
        if (prog >= 100) {
          // Action bar / suggestion dwell — execute or select
          if (letter) {
            if (['COPY','WHATSAPP','ASK AI','RESET_HISTORY'].includes(letter)) executeAction(letter);
            else selectPrediction(letter);
          }
          stateRef.current.hoverStart = Date.now();
          hit.style.setProperty('--dwell-progress', '0%');
        }
      }
    } else {
      if (stateRef.current.hoverBtn && !(stateRef.current.hoverBtn.closest('#keyboard-area'))) {
        stateRef.current.hoverBtn.style.setProperty('--dwell-progress', '0%');
        stateRef.current.hoverBtn.style.backgroundColor = '';
        stateRef.current.hoverBtn = null;
        setHoverBtn(null);
      }
    }
  };

  if (!hasStarted) {
    return (
      <div className="login-screen">
        <div className="start-card">
           <h1>EyeType</h1>
           <p className="tagline">Gaze-powered keyboard with AI text prediction. Built for accessibility, works on any device with a camera.</p>
           
           <button onClick={startEngine} className="start-btn">
              👁️ START SENSORS & AI
           </button>

           <div className="info-row">
             <span className="info-chip">📷 Camera Required</span>
             <span className="info-chip">🔒 100% Private</span>
           </div>
        </div>
      </div>
    )
  }

  let expectedNextChar = '';
  if (predictions.length > 0) {
     const words = typedText.trim().split(' ');
     const currentWordChunk = words[words.length - 1] || '';
     const prediction = predictions[0];
     if (prediction.toLowerCase().startsWith(currentWordChunk.toLowerCase())) {
         expectedNextChar = prediction[currentWordChunk.length]?.toUpperCase() || '';
     }
  }

  return (
    <div className="app-container">
      <div className="app-top-bar">
        <span className="status-badge">{tier === 'REGISTERED' ? '🌟 REGISTERED' : '👤 GUEST'}</span>
        <span className="distance-badge">📏 {distanceCm > 0 ? `~${distanceCm}cm` : '---'}</span>
        
        <div className="mode-toggle">
            <span style={{opacity: inputMode === 'standard' ? 1 : 0.5}}>Standard</span>
            <label className="switch">
                <input type="checkbox" checked={inputMode === 'morse'} onChange={(e) => setInputMode(e.target.checked ? 'morse' : 'standard')} />
                <span className="slider"></span>
            </label>
            <span style={{opacity: inputMode === 'morse' ? 1 : 0.5, color: inputMode === 'morse' ? 'var(--accent-color)' : 'inherit', fontWeight: inputMode === 'morse' ? 'bold' : 'normal'}}>Morse</span>
        </div>

        <select value={theme} onChange={(e) => applyTheme(e.target.value as any)}>
          {Object.keys(THEMES).map(t => <option key={t} value={t} style={{color: '#000'}}>{t}</option>)}
        </select>
      </div>

      <div className="camera-container glass-panel" style={{margin: '0 10px', position: 'relative'}}>
        <video ref={videoRef} className="input_video" playsInline muted />
        <canvas ref={canvasRef} className="output_canvas" width="640" height="480" />

        {/* ── CALIBRATION OVERLAY ── */}
        {calibPhase === 'calibrating' && (
          <div className="calib-overlay">
            <div className="calib-crosshair">
              <div className="calib-ring" style={{borderColor: calibWarning ? '#ef4444' : '#10b981'}}>
                <div className="calib-dot" style={{background: calibWarning ? '#ef4444' : '#10b981'}} />
              </div>
            </div>
            <div className="calib-info">
              <p className="calib-title">👁️ Calibrating Gaze Sensor</p>
              <p className="calib-subtitle">Look directly at the camera and hold still...</p>
              <div className="calib-bar-track">
                <div className="calib-bar-fill" style={{width: `${calibProgress}%`}} />
              </div>
              <p className="calib-countdown">{Math.max(0, Math.ceil((3000 - calibProgress * 30) / 1000))}s remaining</p>
              {calibWarning && <p className="calib-warning">{calibWarning}</p>}
            </div>
          </div>
        )}

        {cameraStatus !== 'Live' && calibPhase !== 'calibrating' && (
            <div style={{position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: 'var(--accent-color)', fontWeight: 'bold', textShadow: '0 0 10px #000'}}>
               📡 {cameraStatus}
            </div>
        )}
      </div>

      <div className="ui-container glass-panel" style={{margin: '10px', height: '60vh'}}>
        <div className={`suggestion-bar ${inputMode === 'morse' ? 'hybrid-bar' : ''}`}>
          {predictions.map(p => (
            <div key={p} className="suggestion-pill gaze-btn" data-letter={p} onClick={() => selectPrediction(p)}>
              {p}
            </div>
          ))}
          {predictions.length === 0 && <span style={{color: 'var(--text-secondary)'}}>Modeling behavior...</span>}
        </div>

        {/* Blink feedback widget — always visible so user sees reset charging */}
        <div className="blink-widget" style={{display: inputMode === 'morse' || blinkStatus !== 'idle' ? 'flex' : 'none'}}>
            {blinkStatus === 'idle' && morseSequence.length === 0 && <span style={{opacity: 0.5, fontSize: '1rem'}}>Ready (Blink to type)</span>}
            {blinkStatus === 'idle' && morseSequence.length > 0 && <span className="morse-seq">{morseSequence}</span>}
            {blinkStatus !== 'idle' && (
                <>
                    <div className={`blink-dash ${blinkStatus === 'dash' ? 'active' : ''} ${blinkStatus === 'mega' ? 'blink-mega' : ''} ${blinkStatus === 'clear' ? 'blink-clear' : ''} ${blinkStatus === 'reset' ? 'blink-reset' : ''}`}></div>
                    <div className={`blink-dot ${blinkStatus === 'dot' ? 'active' : ''}`}></div>
                    <span style={{position: 'absolute', zIndex: 1, textShadow: '0 0 5px #000'}}>
                        {blinkStatus === 'mega' ? 'ACCEPT WORD' : blinkStatus === 'clear' ? 'CLEAR WORD' : blinkStatus === 'reset' ? '🗑 HISTORY RESET' : morseSequence}
                    </span>
                </>
            )}
        </div>

        <div className="text-output">
          <span id="typed-text">{typedText}</span><span className="blinking-cursor">|</span>
        </div>

        <div style={{display: 'flex', gap: '10px', flexGrow: 1, minHeight: 0}}>
            {inputMode === 'standard' ? (
                <div id="keyboard-area" style={{position: 'relative', flexGrow: 1, minHeight: 0}}>
                  <div className={`keyboard-grid ${isDesktop ? 'desktop-grid' : 'mobile-grid'}`} style={{height: '100%'}}>
                    {isDesktop ? (
                      <>
                        {/* PC Layout: 0-9 then A-Z */}
                        {['1','2','3','4','5','6','7','8','9','0'].map(l => <button key={l} className={`gaze-btn ${hoverBtn?.dataset.letter === l ? 'hover-active' : ''} ${l === expectedNextChar ? 'key-floating' : ''}`} data-letter={l}>{l}</button>)}
                        {['Q','W','E','R','T','Y','U','I','O','P'].map(l => <button key={l} className={`gaze-btn ${hoverBtn?.dataset.letter === l ? 'hover-active' : ''} ${l === expectedNextChar ? 'key-floating' : ''}`} data-letter={l}>{l}</button>)}
                        {['A','S','D','F','G','H','J','K','L', 'SPACE'].map(l => <button key={l} className={`gaze-btn ${hoverBtn?.dataset.letter === l ? 'hover-active' : ''} ${l === expectedNextChar ? 'key-floating' : ''}`} data-letter={l}>{l === 'SPACE' ? '␣' : l}</button>)}
                        {['Z','X','C','V','B','N','M', 'CLEAR', 'BACKSPACE'].map(l => (
                          <button key={l} 
                            className={`gaze-btn ${hoverBtn?.dataset.letter === l ? 'hover-active' : ''}`} 
                            data-letter={l} 
                            style={l === 'BACKSPACE' ? {gridColumn: 'span 2'} : {}}
                          >
                            {l === 'CLEAR' ? 'CLR' : l === 'BACKSPACE' ? 'DEL ALL' : l}
                          </button>
                        ))}
                      </>
                    ) : (
                      <>
                        {/* Mobile Layout: A-L (existing) */}
                        {['A', 'B', 'C', 'D'].map(l => <button key={l} className={`gaze-btn ${hoverBtn?.dataset.letter === l ? 'hover-active' : ''} ${l === expectedNextChar ? 'key-floating' : ''}`} data-letter={l}>{l}</button>)}
                        {['E', 'F', 'G', 'H'].map(l => <button key={l} className={`gaze-btn ${hoverBtn?.dataset.letter === l ? 'hover-active' : ''} ${l === expectedNextChar ? 'key-floating' : ''}`} data-letter={l}>{l}</button>)}
                        {['I', 'J', 'K', 'L'].map(l => <button key={l} className={`gaze-btn ${hoverBtn?.dataset.letter === l ? 'hover-active' : ''} ${l === expectedNextChar ? 'key-floating' : ''}`} data-letter={l}>{l}</button>)}
                        {['SPACE', 'CLEAR', 'BACKSPACE'].map(l => <button key={l} className={`gaze-btn ${hoverBtn?.dataset.letter === l ? 'hover-active' : ''}`} data-letter={l} style={l === 'BACKSPACE' ? {gridColumn: 'span 2'} : {}}>{l === 'SPACE' ? '␣' : l === 'CLEAR' ? 'CLR' : 'DEL ALL'}</button>)}
                      </>
                    )}
                  </div>

                  {/* ── Keyboard Gaze Cursor (circle + dot + dwell ring) ── */}
                  {/* No display:none React prop — CSS hides it; JS always wins via ref */}
                  <div ref={keyboardCursorRef} id="keyboard-cursor">
                    <svg viewBox="0 0 40 40" width="48" height="48">
                      {/* Background ring */}
                      <circle cx="20" cy="20" r="17" className="kc-track" />
                      {/* Dwell progress ring — strokes from top (rotated -90°) */}
                      <circle
                        cx="20" cy="20" r="17"
                        className="kc-progress"
                        ref={keyboardCursorCircleRef}
                        strokeDasharray={CIRCUMFERENCE.toFixed(2)}
                        strokeDashoffset={CIRCUMFERENCE.toFixed(2)}
                      />
                      {/* Center dot */}
                      <circle cx="20" cy="20" r="4" className="kc-dot" />
                    </svg>
                  </div>
                </div>
            ) : (
                <div className="morse-grid" 
                     onTouchStart={() => {
                         stateRef.current.touchStart = Date.now();
                         setBlinkStatus('dot'); 
                     }}
                     onTouchEnd={() => {
                         if(stateRef.current.touchStart > 0) {
                             processMorseDuration(Date.now() - stateRef.current.touchStart);
                             stateRef.current.touchStart = 0;
                         }
                     }}>
                    {Object.entries(MORSE_DICT).map(([seq, char]) => (
                        <div key={char} className={`morse-item ${char === expectedNextChar ? 'key-floating' : ''}`}>
                            <span className="morse-char">{char}</span>
                            <span className="morse-seq">{seq}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* REGISTERED ACTION BAR */}
            {tier === 'REGISTERED' && (
                <div className="action-bar">
                    <button className={`gaze-btn btn-copy ${hoverBtn?.dataset.letter === 'COPY' ? 'hover-active' : ''}`} data-letter="COPY" onClick={() => executeAction('COPY')}>COPY</button>
                    <button className={`gaze-btn btn-whatsapp ${hoverBtn?.dataset.letter === 'WHATSAPP' ? 'hover-active' : ''}`} data-letter="WHATSAPP" onClick={() => executeAction('WHATSAPP')}>W-APP</button>
                    <button className={`gaze-btn btn-ai ${hoverBtn?.dataset.letter === 'ASK AI' ? 'hover-active' : ''}`} data-letter="ASK AI" onClick={() => executeAction('ASK AI')}>ASK AI</button>
                    <button className={`gaze-btn btn-reset ${hoverBtn?.dataset.letter === 'RESET_HISTORY' ? 'hover-active' : ''}`} data-letter="RESET_HISTORY" onClick={() => executeAction('RESET_HISTORY')} title="Clear all history">🗑</button>
                </div>
            )}
        </div>
      </div>

      <div ref={cursorRef} id="gaze-cursor"></div>
    </div>
  );
}

export default App;
