import { useEffect, useRef } from 'react';

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

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;

    let targetRotateX = 0;
    let targetRotateY = 0;
    let currentRotateX = 0;
    let currentRotateY = 0;
    let currentScale = 1;
    let targetScale = 1;
    let raf = 0;

    const onMouseMove = (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      const normX = (x - centerX) / centerX;
      const normY = (y - centerY) / centerY;

      targetRotateY = clamp(normX * rotateAmplitude, -rotateAmplitude, rotateAmplitude);
      targetRotateX = clamp(-normY * rotateAmplitude, -rotateAmplitude, rotateAmplitude);
      targetScale = scaleOnHover;

      if (glareRef.current && glare > 0) {
        const glareX = ((x / rect.width) * 100).toFixed(1);
        const glareY = ((y / rect.height) * 100).toFixed(1);
        glareRef.current.style.background = `radial-gradient(circle at ${glareX}% ${glareY}%, rgba(255,255,255,${glare}) 0%, rgba(255,255,255,0) 65%)`;
        glareRef.current.style.opacity = '1';
      }
    };

    const onMouseEnter = () => {
      targetScale = scaleOnHover;
    };

    const onMouseLeave = () => {
      targetRotateX = 0;
      targetRotateY = 0;
      targetScale = 1;
      if (glareRef.current) {
        glareRef.current.style.opacity = '0';
      }
    };

    const loop = () => {
      const ease = 0.14;
      currentRotateX += (targetRotateX - currentRotateX) * ease;
      currentRotateY += (targetRotateY - currentRotateY) * ease;
      currentScale += (targetScale - currentScale) * ease;

      if (card) {
        card.style.transform = `perspective(${perspective}px) rotateX(${currentRotateX.toFixed(
          2
        )}deg) rotateY(${currentRotateY.toFixed(2)}deg) scale3d(${currentScale.toFixed(
          3
        )}, ${currentScale.toFixed(3)}, 1)`;
      }

      raf = requestAnimationFrame(loop);
    };

    card.addEventListener('mousemove', onMouseMove, { passive: true });
    card.addEventListener('mouseenter', onMouseEnter);
    card.addEventListener('mouseleave', onMouseLeave);
    raf = requestAnimationFrame(loop);

    return () => {
      card.removeEventListener('mousemove', onMouseMove);
      card.removeEventListener('mouseenter', onMouseEnter);
      card.removeEventListener('mouseleave', onMouseLeave);
      cancelAnimationFrame(raf);
    };
  }, [rotateAmplitude, scaleOnHover, glare, perspective]);

  return (
    <div
      ref={cardRef}
      onClick={onClick}
      className={`relative will-change-transform transition-shadow duration-300 ${className}`.trim()}
      style={{
        transformStyle: 'preserve-3d',
        ...style
      }}
    >
      {children}

      {glare > 0 && (
        <span
          ref={glareRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-20 rounded-[inherit] opacity-0 transition-opacity duration-300 mix-blend-overlay"
        />
      )}
    </div>
  );
}
