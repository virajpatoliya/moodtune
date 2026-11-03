import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useFinePointer } from './motion.js';

export default function TargetCursor({
  targetSelector = 'button, a, input, [role="button"], [data-cursor-target], .cursor-target',
  hideNativeCursor = false,
  className = '',
  style = {}
}) {
  const cursorRef = useRef(null);
  // Touch screens and reduced-motion users keep the native cursor only.
  const hasPointer = useFinePointer();
  const [isHovered, setIsHovered] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!hasPointer) return;

    if (hideNativeCursor) {
      document.documentElement.classList.add('cursor-none');
    }

    return () => {
      document.documentElement.classList.remove('cursor-none');
    };
  }, [hasPointer, hideNativeCursor]);

  useEffect(() => {
    if (!hasPointer) return;

    let mouseX = -100;
    let mouseY = -100;
    let targetX = -100;
    let targetY = -100;
    let currentX = -100;
    let currentY = -100;
    let targetWidth = 28;
    let targetHeight = 28;
    let currentWidth = 28;
    let currentHeight = 28;
    let isLocked = false;
    let animationFrameId = 0;

    const lockOnto = (eventTarget) => {
      const target = eventTarget?.closest ? eventTarget.closest(targetSelector) : null;
      if (target && !target.disabled) {
        const rect = target.getBoundingClientRect();
        targetX = rect.left + rect.width / 2;
        targetY = rect.top + rect.height / 2;
        targetWidth = Math.min(rect.width + 12, 340);
        targetHeight = Math.min(rect.height + 12, 140);
        isLocked = true;
        setIsHovered(true);
      } else {
        targetX = mouseX;
        targetY = mouseY;
        targetWidth = 28;
        targetHeight = 28;
        isLocked = false;
        setIsHovered(false);
      }
      wake();
    };

    const onMouseMove = (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      setIsVisible(true);
      lockOnto(e.target);
    };

    // The page moves under a parked cursor while scrolling; re-measure whatever is beneath it now.
    const onScroll = () => {
      if (mouseX < 0) return;
      lockOnto(document.elementFromPoint(mouseX, mouseY));
    };

    const onMouseLeave = () => {
      setIsVisible(false);
    };

    function wake() {
      if (!animationFrameId) animationFrameId = requestAnimationFrame(animate);
    }

    // Runs only while the reticle is catching up, then idles until the next move.
    function animate() {
      const ease = isLocked ? 0.28 : 0.45;
      if (currentX === -100) {
        currentX = targetX;
        currentY = targetY;
        currentWidth = targetWidth;
        currentHeight = targetHeight;
      } else {
        currentX += (targetX - currentX) * ease;
        currentY += (targetY - currentY) * ease;
        currentWidth += (targetWidth - currentWidth) * ease;
        currentHeight += (targetHeight - currentHeight) * ease;
      }

      if (cursorRef.current) {
        cursorRef.current.style.transform = `translate3d(${currentX - currentWidth / 2}px, ${
          currentY - currentHeight / 2
        }px, 0)`;
        cursorRef.current.style.width = `${Math.round(currentWidth)}px`;
        cursorRef.current.style.height = `${Math.round(currentHeight)}px`;
      }

      const settled =
        Math.abs(targetX - currentX) < 0.1 &&
        Math.abs(targetY - currentY) < 0.1 &&
        Math.abs(targetWidth - currentWidth) < 0.1 &&
        Math.abs(targetHeight - currentHeight) < 0.1;
      animationFrameId = settled ? 0 : requestAnimationFrame(animate);
    }

    window.addEventListener('mousemove', onMouseMove, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true, capture: true });
    document.documentElement.addEventListener('mouseleave', onMouseLeave);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('scroll', onScroll, { capture: true });
      document.documentElement.removeEventListener('mouseleave', onMouseLeave);
      cancelAnimationFrame(animationFrameId);
    };
  }, [hasPointer, targetSelector]);

  if (!hasPointer || typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={cursorRef}
      aria-hidden="true"
      className={`pointer-events-none fixed left-0 top-0 z-[99999] transition-opacity duration-200 will-change-transform ${
        isVisible ? 'opacity-100' : 'opacity-0'
      } ${className}`}
      style={{
        ...style,
      }}
    >
      {/* 4 Corner reticle brackets */}
      <span
        className={`absolute left-0 top-0 h-2.5 w-2.5 border-l-2 border-t-2 transition-colors duration-200 ${
          isHovered ? 'border-amber-400' : 'border-violet-400/80'
        }`}
        style={{ borderRadius: isHovered ? '4px 0 0 0' : '2px 0 0 0' }}
      />
      <span
        className={`absolute right-0 top-0 h-2.5 w-2.5 border-r-2 border-t-2 transition-colors duration-200 ${
          isHovered ? 'border-amber-400' : 'border-violet-400/80'
        }`}
        style={{ borderRadius: isHovered ? '0 4px 0 0' : '0 2px 0 0' }}
      />
      <span
        className={`absolute bottom-0 left-0 h-2.5 w-2.5 border-b-2 border-l-2 transition-colors duration-200 ${
          isHovered ? 'border-amber-400' : 'border-violet-400/80'
        }`}
        style={{ borderRadius: isHovered ? '0 0 0 4px' : '0 0 0 2px' }}
      />
      <span
        className={`absolute bottom-0 right-0 h-2.5 w-2.5 border-b-2 border-r-2 transition-colors duration-200 ${
          isHovered ? 'border-amber-400' : 'border-violet-400/80'
        }`}
        style={{ borderRadius: isHovered ? '0 0 4px 0' : '0 0 2px 0' }}
      />

      {/* Center target dot */}
      <span
        className={`absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full transition-all duration-200 ${
          isHovered
            ? 'scale-125 bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]'
            : 'scale-100 bg-violet-300 shadow-[0_0_6px_rgba(196,181,253,0.6)]'
        }`}
      />
    </div>,
    document.body
  );
}
