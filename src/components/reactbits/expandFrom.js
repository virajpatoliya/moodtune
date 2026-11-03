import { REDUCED_MOTION_QUERY } from './motion.js';

// "Container transform" open effect: the panel starts as a window the size and place of the
// control that opened it (the search pill, the mini player) and grows to its full size.
// Only transform and clip-path animate, so it stays on the compositor and works on phones.
export function expandFrom(element, origin, { duration = 520, radius = 28 } = {}) {
  if (!element || typeof element.animate !== 'function') return null;

  if (!origin?.width || window.matchMedia?.(REDUCED_MOTION_QUERY).matches) {
    return element.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 180, easing: 'ease-out' });
  }

  const target = element.getBoundingClientRect();
  const dx = origin.left + origin.width / 2 - (target.left + target.width / 2);
  const dy = origin.top + origin.height / 2 - (target.top + target.height / 2);
  // Clip the panel down to the origin's size, centred, then let it open out.
  const insetX = Math.max(0, (target.width - origin.width) / 2);
  const insetY = Math.max(0, (target.height - origin.height) / 2);
  const finalRadius = getComputedStyle(element).borderRadius || '0px';

  return element.animate(
    [
      {
        transform: `translate(${dx}px, ${dy}px)`,
        clipPath: `inset(${insetY}px ${insetX}px round ${radius}px)`,
        opacity: 0.85
      },
      {
        transform: 'translate(0, 0)',
        clipPath: `inset(0px 0px round ${finalRadius})`,
        opacity: 1
      }
    ],
    { duration, easing: 'cubic-bezier(0.2, 0.9, 0.25, 1)' }
  );
}

// A small "landed back" pulse for the control once its panel closes.
export function settleBack(element) {
  if (!element || typeof element.animate !== 'function') return null;
  if (window.matchMedia?.(REDUCED_MOTION_QUERY).matches) return null;
  return element.animate(
    [{ scale: '1.04', filter: 'brightness(1.25)' }, { scale: '1', filter: 'brightness(1)' }],
    { duration: 420, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }
  );
}
