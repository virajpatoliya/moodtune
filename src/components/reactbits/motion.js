import { useSyncExternalStore } from 'react';

// Shared media-query hooks so every effect gates on the same rules:
// - pointer-driven effects (tilt, magnet, custom cursor) only run with a real hovering mouse
// - everything animated backs off when the user asks for reduced motion
export const FINE_POINTER_QUERY = '(hover: hover) and (pointer: fine)';
export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

const matches = (query) =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(query).matches;

const subscribeTo = (query) => (onChange) => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {};
  const list = window.matchMedia(query);
  list.addEventListener('change', onChange);
  return () => list.removeEventListener('change', onChange);
};

const subscribeFine = subscribeTo(FINE_POINTER_QUERY);
const subscribeReduced = subscribeTo(REDUCED_MOTION_QUERY);

export function useReducedMotion() {
  return useSyncExternalStore(subscribeReduced, () => matches(REDUCED_MOTION_QUERY), () => false);
}

export function useFinePointer() {
  const fine = useSyncExternalStore(subscribeFine, () => matches(FINE_POINTER_QUERY), () => false);
  const reduced = useReducedMotion();
  return fine && !reduced;
}
