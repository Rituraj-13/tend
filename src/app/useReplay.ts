import { useCallback, useEffect, useState } from "react";

export interface Replay {
  step: number;
  total: number;
  playing: boolean;
  done: boolean;
  toggle: () => void;
  restart: () => void;
  go: () => void;
  next: () => void;
  prev: () => void;
  jump: (step: number) => void;
}

export function useReplay(total: number, interval = 1700): Replay {
  const [step, setStep] = useState(total);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing) return;
    if (step >= total) {
      setPlaying(false);
      return;
    }
    const timer = window.setTimeout(() => {
      setStep((value) => Math.min(total, value + 1));
    }, interval);
    return () => window.clearTimeout(timer);
  }, [playing, step, total, interval]);

  const jump = useCallback(
    (value: number) => {
      setPlaying(false);
      setStep(Math.max(1, Math.min(total, value)));
    },
    [total],
  );

  const restart = useCallback(() => {
    setStep(1);
    setPlaying(true);
  }, []);

  const toggle = useCallback(() => {
    if (playing) {
      setPlaying(false);
      return;
    }
    if (step >= total) setStep(1);
    setPlaying(true);
  }, [playing, step, total]);

  const next = useCallback(() => jump(step + 1), [jump, step]);
  const prev = useCallback(() => jump(step - 1), [jump, step]);
  const go = useCallback(() => jump(1), [jump]);

  return {
    step,
    total,
    playing,
    done: step >= total,
    toggle,
    restart,
    go,
    next,
    prev,
    jump,
  };
}
