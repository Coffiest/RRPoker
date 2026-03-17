"use client";
import React, { createContext, useContext, useState } from "react";

export type TimerState = {
  currentLevelIndex: number;
  timeRemaining: number;
  isRunning: boolean;
  skipLevel: () => void;
  setIsRunning: (v: boolean) => void;
  setCurrentLevelIndex: (v: number) => void;
};

const TimerContext = createContext<TimerState | undefined>(undefined);

export const useTimer = () => {
  const ctx = useContext(TimerContext);
  if (!ctx) throw new Error("TimerContext未定義");
  return ctx;
};

export const TimerProvider: React.FC<{ levels: any[]; children: React.ReactNode }> = ({ levels, children }) => {
  
  const [currentLevelIndex, setCurrentLevelIndex] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(levels[0]?.duration ? levels[0].duration * 60 : 1200);
  const [isRunning, setIsRunning] = useState(false);

  const skipLevel = () => {
    if (currentLevelIndex < levels.length - 1) {
      const next = currentLevelIndex + 1;
      setCurrentLevelIndex(next);
      setTimeRemaining(levels[next].duration ? levels[next].duration * 60 : 0);
      setIsRunning(true);
    } else {
      setIsRunning(false);
      setTimeRemaining(0);
    }
  };

  return (
    <TimerContext.Provider value={{ currentLevelIndex, timeRemaining, isRunning, skipLevel, setIsRunning, setCurrentLevelIndex }}>
      {children}
    </TimerContext.Provider>
  );
};
