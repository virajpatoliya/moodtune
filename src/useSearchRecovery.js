import { useEffect, useRef } from 'react';
import { searchCooldownRemaining } from './musicDiscovery.js';

// When a section failed because Apple's search is cooling down, retry it once the cooldown ends.
export function useSearchRecovery(failed, retry) {
  const retryRef = useRef(retry);
  useEffect(() => {
    retryRef.current = retry;
  });
  useEffect(() => {
    if (!failed) return undefined;
    const wait = searchCooldownRemaining();
    if (!wait) return undefined;
    const timer = setTimeout(() => retryRef.current(), wait + 500);
    return () => clearTimeout(timer);
  }, [failed]);
}
