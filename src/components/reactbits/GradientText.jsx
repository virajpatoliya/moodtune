import { useEffect, useRef } from 'react';

export default function GradientText({
  children,
  colors = ['#c4b5fd', '#f472b6', '#fb923c', '#c4b5fd'],
  animationSpeed = 6,
  angle = 90,
  glow = 0.4,
  className = '',
  style
}) {
  const rootRef = useRef(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    if (reduced) return;

    let raf = 0;
    let start = performance.now();
    const duration = animationSpeed * 1000;

    const tick = (now) => {
      const elapsed = (now - start) % duration;
      const progress = (elapsed / duration) * 200; // 0% to 200%
      root.style.backgroundPosition = `${progress.toFixed(1)}% 50%`;
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [animationSpeed]);

  const gradientStops = [...colors, ...colors].join(', ');

  return (
    <span
      ref={rootRef}
      className={`inline-block bg-clip-text text-transparent transition-all will-change-[background-position] ${className}`}
      style={{
        backgroundImage: `linear-gradient(${angle}deg, ${gradientStops})`,
        backgroundSize: '200% 200%',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        filter: glow > 0 ? `drop-shadow(0 0 ${glow * 12}px rgba(196,181,253,0.35))` : undefined,
        ...style
      }}
    >
      {children}
    </span>
  );
}
