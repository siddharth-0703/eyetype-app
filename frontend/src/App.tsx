import { useEffect, useRef, useState } from 'react';
import { Camera } from '@mediapipe/camera_utils';
import { FaceMesh } from '@mediapipe/face_mesh';
import type { Results } from '@mediapipe/face_mesh';
import { drawConnectors } from '@mediapipe/drawing_utils';
import { FACEMESH_RIGHT_EYE, FACEMESH_RIGHT_IRIS } from '@mediapipe/face_mesh';
import axios from 'axios';

const DWELL_TIME_MS = 2000;
const HEAVY_DWELL_MS = 4000;
const WARNING_MS = 2000;
const BLINK_THRESHOLD = 0.25;
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
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);

  const [hasStarted, setHasStarted] = useState(false);
  const [tier, setTier] = useState("GUEST");
  const [token, setToken] = useState("GUEST");
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginMsg, setLoginMsg] = useState('');

  const [typedText, setTypedText] = useState('');
  const [predictions, setPredictions] = useState<string[]>([]);
  const [hoverBtn, setHoverBtn] = useState<HTMLElement | null>(null);
  const [theme, setTheme] = useState<keyof typeof THEMES>('Dark');

  const [inputMode, setInputMode] = useState<'standard' | 'morse'>('standard');
  const [morseSequence, setMorseSequence] = useState<string>('');
  const [blinkStatus, setBlinkStatus] = useState<'idle' | 'dot' | 'dash' | 'mega' | 'clear'>('idle');

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
    touchStart: 0
  });

  useEffect(() => {
    stateRef.current.typedText = typedText;
    stateRef.current.token = token;
    stateRef.current.inputMode = inputMode;
    stateRef.current.morseSequence = morseSequence;
    stateRef.current.predictions = predictions;
  }, [typedText, token, inputMode, morseSequence, predictions]);

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
    const words = stateRef.current.typedText.split(' ');
    words.pop(); 
    words.push(word);
    
    const newStr = words.join(' ') + ' ';
    setTypedText(newStr);
    logWord(word); 
    speakText(word); 
    fetchPredictions('');
  };

  const attemptLogin = async () => {
    try {
      const un = username.trim() || 'GUEST';
      const pw = password.trim() || '';
      
      const res = await axios.post(`${API_BASE}/login`, { username: un, password: pw });
      setTier(res.data.tier);
      setToken(res.data.token);
      startEngine();
    } catch(err: any) {
      setLoginMsg(err.response?.data?.detail || "Login Failed. Server Offline?");
    }
  }

  const startEngine = () => {
    setHasStarted(true);

    if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
      (DeviceOrientationEvent as any).requestPermission()
        .then((permissionState: string) => {
          if (permissionState === 'granted') {
            window.addEventListener('deviceorientation', handleGyro, true);
            window.addEventListener('devicemotion', handleMotion, true);
          }
        }).catch(console.error);
    } else {
      window.addEventListener('deviceorientation', handleGyro, true);
      window.addEventListener('devicemotion', handleMotion, true);
    }
    initCamera();
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

  const initCamera = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const faceMesh = new FaceMesh({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}` });
    faceMesh.setOptions({ maxNumFaces: 1, refineLandmarks: true, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
    faceMesh.onResults(onResults);

    const camera = new Camera(videoRef.current, {
      onFrame: async () => { await faceMesh.send({ image: videoRef.current! }); },
      width: 640, height: 480
    });
    camera.start();
    fetchPredictions('');
  };

  const onResults = (results: Results) => {
    const canvas = canvasRef.current;
    if (!canvas) return; const ctx = canvas.getContext('2d'); if (!ctx) return;

    ctx.save(); ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.translate(canvas.width, 0); ctx.scale(-1, 1);
    ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
      const landmarks = results.multiFaceLandmarks[0];
      drawConnectors(ctx, landmarks, FACEMESH_RIGHT_EYE, { color: 'rgba(255,255,255,0.5)', lineWidth: 1 });
      drawConnectors(ctx, landmarks, FACEMESH_RIGHT_IRIS, { color: 'green', lineWidth: 2 });

      const ear = Math.abs(landmarks[159].y - landmarks[145].y) / Math.abs(landmarks[33].x - landmarks[133].x);
      const isBlinking = ear < BLINK_THRESHOLD;
      const now = Date.now();

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
        if (stateRef.current.blinkDurationStart > 0) {
          const duration = now - stateRef.current.blinkDurationStart;
          stateRef.current.blinkDurationStart = 0;
          
          if (stateRef.current.inputMode === 'standard') {
              if (duration < 300 && duration > 50) {
                if (stateRef.current.hoverBtn) {
                   const letter = stateRef.current.hoverBtn.getAttribute('data-letter');
                   if (letter) handleKeyPress(letter);
                }
              } else if (duration >= 300) {
                handleKeyPress("SPACE");
              }
          } else {
              processMorseDuration(duration);
          }
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
      }

      const sW = landmarks[133].x - landmarks[33].x;
      const sH = landmarks[145].y - landmarks[159].y;
      if (sW > 0 && sH > 0) {
        const normX = 1.0 - ((landmarks[468].x - landmarks[33].x) / sW);
        const normY = (landmarks[468].y - landmarks[159].y) / sH;

        const mX = Math.max(0, Math.min(1, (normX - 0.35) / 0.3));
        const mY = Math.max(0, Math.min(1, (normY - 0.35) / 0.3));

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
        checkIntersections();
      }
    }
    ctx.restore();
  };

  const checkIntersections = () => {
    let hitEl: HTMLElement | null = null;
    document.querySelectorAll('.gaze-btn').forEach(b => {
      const rect = (b as HTMLElement).getBoundingClientRect();
      if (stateRef.current.smoothX >= rect.left && stateRef.current.smoothX <= rect.right &&
          stateRef.current.smoothY >= rect.top && stateRef.current.smoothY <= rect.bottom) {
        hitEl = b as HTMLElement;
      }
    });

    const hit = hitEl as HTMLElement | null;
    if (hit) {
      if (stateRef.current.hoverBtn !== hit) {
        if(stateRef.current.hoverBtn) stateRef.current.hoverBtn.style.setProperty('--dwell-progress', `0%`);
        hit.style.backgroundColor = '';
        stateRef.current.hoverBtn = hit;
        setHoverBtn(hit);
        stateRef.current.hoverStart = Date.now();
        stateRef.current.hasWarned = false;
      } else {
        const letter = hit.getAttribute('data-letter');
        const reqDwell = letter === 'BACKSPACE' ? HEAVY_DWELL_MS : DWELL_TIME_MS;
        
        const elapsed = Date.now() - stateRef.current.hoverStart;
        const prog = Math.min(100, (elapsed / reqDwell) * 100);
        hit.style.setProperty('--dwell-progress', `${prog}%`);

        if (letter === 'BACKSPACE' && elapsed > WARNING_MS) {
            hit.style.backgroundColor = 'rgba(239, 68, 68, 0.8)'; 
            hit.style.color = 'white';
            if (!stateRef.current.hasWarned) {
                speakText("Warning, Deleting All");
                stateRef.current.hasWarned = true;
            }
        }

        if (prog >= 100) {
          if (letter) handleKeyPress(letter);
          hit.style.setProperty('--dwell-progress', `0%`);
          hit.style.backgroundColor = '';
          stateRef.current.hoverStart = Date.now(); 
          stateRef.current.hasWarned = false;
        }
      }
    } else {
      if (stateRef.current.hoverBtn) {
        stateRef.current.hoverBtn.style.setProperty('--dwell-progress', `0%`);
        stateRef.current.hoverBtn.style.backgroundColor = '';
        stateRef.current.hoverBtn = null;
        setHoverBtn(null);
        stateRef.current.hasWarned = false;
      }
    }
  };

  if (!hasStarted) {
    return (
      <div style={{height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#000', color: '#fff'}}>
        <h1 style={{fontSize: '2rem', marginBottom: '1rem'}}>EyeType Portal</h1>
        
        <div className="glass-panel" style={{padding: '30px', display: 'flex', flexDirection: 'column', gap: '15px', width: '300px'}}>
            <input type="text" placeholder="Username (Leave blank for Guest)" value={username} onChange={e => setUsername(e.target.value)} style={{padding: '10px', borderRadius: '8px', border: 'none'}} />
            <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} style={{padding: '10px', borderRadius: '8px', border: 'none'}} />
            <button onClick={attemptLogin} style={{padding: '12px', background: '#38bdf8', border: 'none', borderRadius: '8px', color: '#fff', fontWeight: 'bold', cursor: 'pointer'}}>LOGIN & START SENSORS</button>
            <p style={{color: '#ef4444', fontSize: '0.8rem', textAlign: 'center'}}>{loginMsg}</p>
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
      <div style={{display: 'flex', justifyContent: 'space-between', padding: '5px 15px', fontSize: '0.8rem', alignItems: 'center', flexWrap: 'wrap', gap: '10px'}}>
        <span>{tier === 'REGISTERED' ? '🌟 REGISTERED ACTIVE' : '👤 GUEST MODE'}</span>
        
        <div style={{display: 'flex', alignItems: 'center', gap: '5px', background: 'rgba(255,255,255,0.05)', padding: '5px 10px', borderRadius: '20px'}}>
            <span style={{opacity: inputMode === 'standard' ? 1 : 0.5}}>Standard</span>
            <label className="switch">
                <input type="checkbox" checked={inputMode === 'morse'} onChange={(e) => setInputMode(e.target.checked ? 'morse' : 'standard')} />
                <span className="slider"></span>
            </label>
            <span style={{opacity: inputMode === 'morse' ? 1 : 0.5, color: inputMode === 'morse' ? 'var(--accent-color)' : 'inherit', fontWeight: inputMode === 'morse' ? 'bold' : 'normal'}}>Morse Mode</span>
        </div>

        <select value={theme} onChange={(e) => applyTheme(e.target.value as any)} style={{background: 'transparent', color: 'inherit', border: 'none'}}>
          {Object.keys(THEMES).map(t => <option key={t} value={t} style={{color: '#000'}}>{t}</option>)}
        </select>
      </div>

      <div className="camera-container glass-panel" style={{margin: '0 10px'}}>
        <video ref={videoRef} className="input_video" style={{ display: 'none' }} />
        <canvas ref={canvasRef} className="output_canvas" width="640" height="480" />
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

        {inputMode === 'morse' && (
            <div className="blink-widget">
                {blinkStatus === 'idle' && morseSequence.length === 0 && <span style={{opacity: 0.5, fontSize: '1rem'}}>Ready (Blink to type)</span>}
                {blinkStatus === 'idle' && morseSequence.length > 0 && <span className="morse-seq">{morseSequence}</span>}
                {blinkStatus !== 'idle' && (
                    <>
                        <div className={`blink-dash ${blinkStatus === 'dash' ? 'active' : ''} ${blinkStatus === 'mega' ? 'blink-mega' : ''} ${blinkStatus === 'clear' ? 'blink-clear' : ''}`}></div>
                        <div className={`blink-dot ${blinkStatus === 'dot' ? 'active' : ''}`}></div>
                        <span style={{position: 'absolute', zIndex: 1, textShadow: '0 0 5px #000'}}>
                            {blinkStatus === 'mega' ? 'ACCEPT WORD' : blinkStatus === 'clear' ? 'CLEAR ALL' : morseSequence}
                        </span>
                    </>
                )}
            </div>
        )}

        <div className="text-output" style={{whiteSpace: 'pre-wrap', fontSize: '1.2rem', overflowY: 'auto', flexGrow: inputMode==='morse' ? 0 : 0 }}>
          <span id="typed-text">{typedText}</span><span className="blinking-cursor">|</span>
        </div>

        <div style={{display: 'flex', gap: '10px', flexGrow: 1, minHeight: 0}}>
            {inputMode === 'standard' ? (
                <div className="keyboard-grid" style={{flexGrow: 1}}>
                {['A', 'B', 'C', 'D'].map(l => <button key={l} className={`gaze-btn ${hoverBtn?.dataset.letter === l ? 'hover-active' : ''} ${l === expectedNextChar ? 'key-floating' : ''}`} data-letter={l}>{l}</button>)}
                {['E', 'F', 'G', 'H'].map(l => <button key={l} className={`gaze-btn ${hoverBtn?.dataset.letter === l ? 'hover-active' : ''} ${l === expectedNextChar ? 'key-floating' : ''}`} data-letter={l}>{l}</button>)}
                {['I', 'J', 'K', 'L'].map(l => <button key={l} className={`gaze-btn ${hoverBtn?.dataset.letter === l ? 'hover-active' : ''} ${l === expectedNextChar ? 'key-floating' : ''}`} data-letter={l}>{l}</button>)}
                {['SPACE', 'CLEAR', 'BACKSPACE'].map(l => <button key={l} className={`gaze-btn ${hoverBtn?.dataset.letter === l ? 'hover-active' : ''}`} data-letter={l} style={l === 'BACKSPACE' ? {gridColumn: 'span 2'} : {}}>{l === 'SPACE' ? '␣' : l === 'CLEAR' ? 'CLR' : 'DEL ALL'}</button>)}
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
                    <button className={`gaze-btn ${hoverBtn?.dataset.letter === 'COPY' ? 'hover-active' : ''}`} data-letter="COPY" style={{flexGrow: 1, fontSize: '0.8rem', background: 'rgba(16, 185, 129, 0.2)'}}>COPY</button>
                    <button className={`gaze-btn ${hoverBtn?.dataset.letter === 'WHATSAPP' ? 'hover-active' : ''}`} data-letter="WHATSAPP" style={{flexGrow: 1, fontSize: '0.6rem', background: 'rgba(34, 197, 94, 0.2)'}}>W-APP</button>
                    <button className={`gaze-btn ${hoverBtn?.dataset.letter === 'ASK AI' ? 'hover-active' : ''}`} data-letter="ASK AI" style={{flexGrow: 1, fontSize: '0.8rem', background: 'rgba(147, 51, 234, 0.2)'}}>ASK AI</button>
                </div>
            )}
        </div>
      </div>

      <div ref={cursorRef} id="gaze-cursor"></div>
    </div>
  );
}

export default App;
