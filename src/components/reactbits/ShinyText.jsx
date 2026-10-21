import { useEffect, useRef } from 'react';

export default function ShinyText({
  text,
  children,
  color = '#94a3b8',
  shineColor = '#ffffff',
  speed = 2.8,
  delay = 0.5,
  angle = 120,
  shineWidth = 45,
  glow = 0.35,
  className = '',
  style
}) {
  const content = children ?? text;
  const rootRef = useRef(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    if (reduced) return;

    let raf = 0;
    let start = performance.now();
    const duration = speed * 1000;
    const pauseMs = delay * 1000;

    const tick = (now) => {
      const elapsed = (now - start) % (duration + pauseMs);
      let p = elapsed / duration;
      if (p > 1) p = 1;

      // Position from -shineWidth to 100 + shineWidth
      const pos = -shineWidth + p * (100 + shineWidth * 2);
      root.style.backgroundImage = `linear-gradient(${angle}deg, ${color} 0%, ${color} ${Math.max(
        0,
        pos - shineWidth / 2
      )}%, ${shineColor} ${pos}%, ${color} ${Math.min(100, pos + shineWidth / 2)}%, ${color} 100%)`;

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [color, shineColor, speed, delay, angle, shineWidth]);

  return (
    <span
      ref={rootRef}
      className={`relative inline-block bg-clip-text text-transparent transition-all ${className}`}
      style={{
        backgroundImage: `linear-gradient(${angle}deg, ${color} 0%, ${shineColor} 50%, ${color} 100%)`,
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        filter: glow > 0 ? `drop-shadow(0 0 ${glow * 8}px ${shineColor}40)` : undefined,
        ...style
      }}
    >
      {content}
    </span>
  );
}
