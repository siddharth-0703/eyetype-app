import React, { createContext, useContext, useState } from 'react';

type InteractionMode = 'standard' | 'gaze';

interface ModeContextType {
  mode: InteractionMode;
  setMode: (mode: InteractionMode) => void;
  toggleMode: () => void;
  gazePos: { x: number; y: number };
  setGazePos: (pos: { x: number; y: number }) => void;
  landmarks: any[];
  setLandmarks: (l: any[]) => void;
  blinkStatus: string;
  setBlinkStatus: (s: string) => void;
}

const ModeContext = createContext<ModeContextType | undefined>(undefined);

export const ModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setMode] = useState<InteractionMode>('standard');
  const [gazePos, setGazePos] = useState({ x: 0, y: 0 });
  const [landmarks, setLandmarks] = useState<any[]>([]);
  const [blinkStatus, setBlinkStatus] = useState<string>('idle');

  const toggleMode = () => {
    setMode((prev) => (prev === 'standard' ? 'gaze' : 'standard'));
  };

  return (
    <ModeContext.Provider value={{ 
      mode, setMode, toggleMode, 
      gazePos, setGazePos, 
      landmarks, setLandmarks,
      blinkStatus, setBlinkStatus 
    }}>
      {children}
    </ModeContext.Provider>
  );
};

export const useMode = () => {
  const context = useContext(ModeContext);
  if (context === undefined) {
    throw new Error('useMode must be used within a ModeProvider');
  }
  return context;
};
