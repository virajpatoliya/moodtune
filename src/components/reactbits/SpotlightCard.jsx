import { useRef } from 'react';

// React Bits SpotlightCard, trimmed down: it only writes two CSS variables on pointer events,
// so there is no animation loop. A mouse lights it on hover; a finger lights it while pressed.
export default function SpotlightCard({
  children,
  spotlightColor = 'rgba(255, 255, 255, 0.18)',
  className = '',
  style
}) {
  const ref = useRef(null);

  const place = (e) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty('--rb-x', `${e.clientX - rect.left}px`);
    el.style.setProperty('--rb-y', `${e.clientY - rect.top}px`);
  };

  const light = (e) => {
    place(e);
    ref.current?.setAttribute('data-lit', '');
  };

  const dim = () => ref.current?.removeAttribute('data-lit');

  return (
    <div
      ref={ref}
      className={`rb-spotlight ${className}`.trim()}
      style={{ '--rb-spot': spotlightColor, ...style }}
      onPointerEnter={(e) => e.pointerType === 'mouse' && light(e)}
      onPointerMove={(e) => (e.pointerType === 'mouse' || e.buttons) && place(e)}
      onPointerDown={light}
      onPointerUp={(e) => e.pointerType !== 'mouse' && dim()}
      onPointerCancel={dim}
      onPointerLeave={dim}
    >
      {children}
    </div>
  );
}
