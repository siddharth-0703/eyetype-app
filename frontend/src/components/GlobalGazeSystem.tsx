import React, { useEffect, useRef, useState } from 'react';
import { useMode } from '../context/ModeContext';

export const GlobalGazeSystem: React.FC = () => {
  const { mode, setGazePos, setLandmarks, setBlinkStatus } = useMode();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isActive, setIsActive] = useState(false);
  const stateRef = useRef({
    smoothX: window.innerWidth / 2,
    smoothY: window.innerHeight / 2,
    calibBaselineX: 0.5,
    calibBaselineY: 0,
    blinkStart: 0,
    lastBlinkEnd: 0,
  });


  useEffect(() => {
    if (mode === 'gaze' && !isActive) {
      initGaze();
    }
  }, [mode, isActive]);

  const initGaze = () => {
    const FaceMesh = (window as any).FaceMesh;
    const Camera = (window as any).Camera;

    if (!FaceMesh || !Camera) return;

    const faceMesh = new FaceMesh({
      locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
    });

    faceMesh.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    faceMesh.onResults((results: any) => {
      if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) return;

      const landmarks = results.multiFaceLandmarks[0];
      setLandmarks(landmarks);
      
      // Core Gaze Logic (Simplified for Global)
      const rIris = landmarks[468]; 
      const lIris = landmarks[473];
      const rIrisX = (rIris.x + lIris.x) / 2;
      const rIrisY = (rIris.y + lIris.y) / 2;

      // Sensitivity Mapping
      const rawX = rIrisX;
      const rawY = rIrisY;

      // Smoothing
      const targetX = (1 - rawX) * window.innerWidth;
      const targetY = rawY * window.innerHeight;

      stateRef.current.smoothX += (targetX - stateRef.current.smoothX) * 0.15;
      stateRef.current.smoothY += (targetY - stateRef.current.smoothY) * 0.15;

      setGazePos({ x: stateRef.current.smoothX, y: stateRef.current.smoothY });

      // Handle Gaze Scrolling
      if (stateRef.current.smoothY < 120) {
        window.scrollBy({ top: -15, behavior: 'instant' });
      } else if (stateRef.current.smoothY > window.innerHeight - 120) {
        window.scrollBy({ top: 15, behavior: 'instant' });
      }

      // Blink / Interaction Detection
      const rEyeH = Math.abs(landmarks[145].y - landmarks[159].y);
      const lEyeH = Math.abs(landmarks[374].y - landmarks[386].y);
      const isBlinking = rEyeH < 0.015 && lEyeH < 0.015;

      if (isBlinking && stateRef.current.blinkStart === 0) {
        stateRef.current.blinkStart = Date.now();
      } else if (!isBlinking && stateRef.current.blinkStart > 0) {
        const duration = Date.now() - stateRef.current.blinkStart;
        stateRef.current.blinkStart = 0;
        
        if (duration > 50 && duration < 400) {
          // Trigger global click event at current gaze pos
          const clickEv = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window,
            clientX: stateRef.current.smoothX,
            clientY: stateRef.current.smoothY
          });
          const element = document.elementFromPoint(stateRef.current.smoothX, stateRef.current.smoothY);
          if (element) element.dispatchEvent(clickEv);
          
          setBlinkStatus('dot');
          setTimeout(() => setBlinkStatus('idle'), 300);
        }
      }
    });

    if (videoRef.current) {
      const camera = new Camera(videoRef.current, {
        onFrame: async () => {
          await faceMesh.send({ image: videoRef.current! });
        },
        width: 640,
        height: 480,
      });
      camera.start();
      setIsActive(true);
    }
  };

  if (mode !== 'gaze') return null;

  return (
    <>
      <video ref={videoRef} style={{ display: 'none' }} />
      <div 
        id="global-gaze-cursor"
        style={{
          position: 'fixed',
          width: '20px',
          height: '20px',
          background: 'rgba(255, 255, 255, 0.5)',
          borderRadius: '50%',
          border: '2px solid white',
          boxShadow: '0 0 10px rgba(0,0,0,0.5)',
          pointerEvents: 'none',
          zIndex: 99999,
          transform: 'translate(-50%, -50%)',
        }}
      />
    </>
  );
};
