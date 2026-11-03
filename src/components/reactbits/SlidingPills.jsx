import { useLayoutEffect, useRef } from 'react';

// Segmented chip bar with one highlight pill that glides to the selected chip
// (the React Bits animated-tabs look). The pill lives inside the scroll container, so it
// scrolls with the chips on narrow screens; the selected chip is scrolled into view.
export default function SlidingPills({ options, value, onChange, ariaLabel, className = '' }) {
  const railRef = useRef(null);
  const pillRef = useRef(null);
  const placedRef = useRef(false);

  useLayoutEffect(() => {
    const rail = railRef.current;
    const pill = pillRef.current;
    if (!rail || !pill) return undefined;

    const place = () => {
      const active = rail.querySelector('[aria-pressed="true"]');
      if (!active) {
        pill.style.opacity = '0';
        return;
      }
      // First placement jumps straight there; later ones animate via the CSS transition.
      if (!placedRef.current) pill.style.transition = 'none';
      pill.style.opacity = '1';
      pill.style.width = `${active.offsetWidth}px`;
      pill.style.height = `${active.offsetHeight}px`;
      pill.style.transform = `translate3d(${active.offsetLeft}px, ${active.offsetTop}px, 0)`;
      if (!placedRef.current) {
        pill.getBoundingClientRect();
        pill.style.transition = '';
        placedRef.current = true;
      }
    };

    place();
    const active = rail.querySelector('[aria-pressed="true"]');
    if (active && rail.scrollWidth > rail.clientWidth) {
      const left = active.offsetLeft - (rail.clientWidth - active.offsetWidth) / 2;
      rail.scrollTo({ left: Math.max(0, left), behavior: placedRef.current ? 'smooth' : 'auto' });
    }

    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(place);
    observer?.observe(rail);
    return () => observer?.disconnect();
  }, [value, options]);

  return (
    <div ref={railRef} role="group" aria-label={ariaLabel} className={`rb-pills ${className}`.trim()}>
      <span ref={pillRef} className="rb-pills-indicator" aria-hidden="true" />
      {options.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={value === option}
          onClick={() => onChange(option)}
          className="rb-pills-option"
        >
          {option}
        </button>
      ))}
    </div>
  );
}
