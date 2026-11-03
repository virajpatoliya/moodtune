import { useEffect, useRef } from 'react';
import { useFinePointer } from './motion.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export default function TiltedCard({
  children,
  rotateAmplitude = 14,
  scaleOnHover = 1.04,
  glare = 0.45,
  perspective = 900,
  className = '',
  style = {},
  onClick
}) {
  const cardRef = useRef(null);
  const glareRef = useRef(null);
  // Tilt only makes sense with a real hovering mouse; on touch it would stick after a tap.
  const enabled = useFinePointer();

  useEffect(() => {
    const card = cardRef.current;
    if (!card || !enabled) return;

    let targetRotateX = 0;
    let targetRotateY = 0;
    let targetScale = 1;
    let currentRotateX = 0;
    let currentRotateY = 0;
    let currentScale = 1;
    let raf = 0;

    const loop = () => {
      const ease = 0.14;
      currentRotateX += (targetRotateX - currentRotateX) * ease;
      currentRotateY += (targetRotateY - currentRotateY) * ease;
      currentScale += (targetScale - currentScale) * ease;

      const settled =
        Math.abs(targetRotateX - currentRotateX) < 0.01 &&
        Math.abs(targetRotateY - currentRotateY) < 0.01 &&
        Math.abs(targetScale - currentScale) < 0.0005;

      if (settled && targetScale === 1) {
        // Back at rest: drop the transform so the card stops being its own layer.
        card.style.transform = '';
        card.style.willChange = '';
        raf = 0;
        return;
      }

      card.style.transform = `perspective(${perspective}px) rotateX(${currentRotateX.toFixed(
        2
      )}deg) rotateY(${currentRotateY.toFixed(2)}deg) scale3d(${currentScale.toFixed(
        3
      )}, ${currentScale.toFixed(3)}, 1)`;
      raf = settled ? 0 : requestAnimationFrame(loop);
    };

    const wake = () => {
      if (!raf) raf = requestAnimationFrame(loop);
    };

    const onPointerMove = (e) => {
      if (e.pointerType !== 'mouse') return;
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const normX = (x - rect.width / 2) / (rect.width / 2);
      const normY = (y - rect.height / 2) / (rect.height / 2);

      targetRotateY = clamp(normX * rotateAmplitude, -rotateAmplitude, rotateAmplitude);
      targetRotateX = clamp(-normY * rotateAmplitude, -rotateAmplitude, rotateAmplitude);
      targetScale = scaleOnHover;
      card.style.willChange = 'transform';

      if (glareRef.current) {
        const glareX = ((x / rect.width) * 100).toFixed(1);
        const glareY = ((y / rect.height) * 100).toFixed(1);
        glareRef.current.style.background = `radial-gradient(circle at ${glareX}% ${glareY}%, rgba(255,255,255,${glare}) 0%, rgba(255,255,255,0) 65%)`;
        glareRef.current.style.opacity = '1';
      }
      wake();
    };

    const onPointerLeave = () => {
      targetRotateX = 0;
      targetRotateY = 0;
      targetScale = 1;
      if (glareRef.current) glareRef.current.style.opacity = '0';
      wake();
    };

    card.addEventListener('pointermove', onPointerMove, { passive: true });
    card.addEventListener('pointerleave', onPointerLeave);

    return () => {
      card.removeEventListener('pointermove', onPointerMove);
      card.removeEventListener('pointerleave', onPointerLeave);
      cancelAnimationFrame(raf);
      card.style.transform = '';
      card.style.willChange = '';
    };
  }, [enabled, rotateAmplitude, scaleOnHover, glare, perspective]);

  return (
    <div
      ref={cardRef}
      onClick={onClick}
      className={`relative ${className}`.trim()}
      style={style}
    >
      {children}

      {enabled && glare > 0 && (
        <span
          ref={glareRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-20 rounded-[inherit] opacity-0 transition-opacity duration-300 mix-blend-overlay"
        />
      )}
    </div>
  );
}
