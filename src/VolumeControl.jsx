import { useEffect, useRef } from 'react';
import { Volume, Volume1, Volume2, VolumeX } from 'lucide-react';
import { useReducedMotion } from './components/reactbits/motion.js';
import { volumeLevel } from './volume.js';

const ICONS = { muted: VolumeX, low: Volume, medium: Volume1, high: Volume2 };
const MAX_STRETCH = 18;
const OVERSHOOT_RANGE = 160;

export function VolumeIcon({ level, muted, className }) {
  const Icon = ICONS[volumeLevel(level, muted)];
  return <Icon className={className} />;
}

// React Bits ElasticSlider feel on top of the native range input (which keeps keyboard and
// screen-reader support): the pill thickens while held, dragging past either end stretches the
// track like rubber, the end icon bumps, and it springs back on release.
function useElasticDrag(reduced) {
  const pillRef = useRef(null);
  const trackRef = useRef(null);
  const minRef = useRef(null);
  const maxRef = useRef(null);
  const cleanupRef = useRef(null);

  useEffect(() => () => cleanupRef.current?.(), []);

  const onPointerDown = (event) => {
    const pill = pillRef.current;
    const track = trackRef.current;
    if (!pill || !track) return;
    pill.classList.add('is-dragging');

    const onMove = (e) => {
      if (reduced) return;
      const rect = pill.getBoundingClientRect();
      const over = e.clientX < rect.left ? e.clientX - rect.left : e.clientX > rect.right ? e.clientX - rect.right : 0;
      // Square-root falloff: easy to start stretching, harder the further you pull.
      const stretch = Math.sign(over) * Math.min(1, Math.sqrt(Math.abs(over) / OVERSHOOT_RANGE)) * MAX_STRETCH;
      track.style.transition = 'none';
      track.style.transformOrigin = over < 0 ? 'right center' : 'left center';
      track.style.transform = stretch ? `scaleX(${1 + Math.abs(stretch) / rect.width}) scaleY(${1 - Math.abs(stretch) / 60})` : '';
      const bump = (el, active) => {
        if (el) el.style.transform = active ? `scale(${1 + Math.abs(stretch) / 40}) translateX(${stretch / 2}px)` : '';
      };
      bump(minRef.current, over < 0);
      bump(maxRef.current, over > 0);
    };

    const release = () => {
      pill.classList.remove('is-dragging');
      track.style.transition = '';
      track.style.transform = '';
      if (minRef.current) minRef.current.style.transform = '';
      if (maxRef.current) maxRef.current.style.transform = '';
      cleanupRef.current?.();
    };

    cleanupRef.current?.();
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    cleanupRef.current = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', release);
      cleanupRef.current = null;
    };
    onMove(event);
  };

  return { pillRef, trackRef, minRef, maxRef, onPointerDown };
}

export default function VolumeControl({ level, muted, supported, accent, onChange, onToggleMute, variant = 'full' }) {
  const state = volumeLevel(level, muted);
  const Icon = ICONS[state];
  const percent = muted ? 0 : Math.round(level * 100);
  const style = { '--vol-fill': `${percent}%`, '--vol-a': accent[0], '--vol-b': accent[1] };
  const muteLabel = state === 'muted' ? 'Unmute' : 'Mute';
  const reduced = useReducedMotion();
  const { pillRef, trackRef, minRef, maxRef, onPointerDown: onPillPointerDown } = useElasticDrag(reduced);

  const slider = supported && (
    <input
      type="range"
      min="0"
      max="100"
      step="1"
      value={percent}
      onChange={(event) => onChange(Number(event.target.value) / 100)}
      onClick={(event) => event.stopPropagation()}
      className="volume-slider"
      aria-label="Volume"
      aria-valuetext={state === 'muted' ? 'Muted' : `${percent}%`}
    />
  );

  if (variant === 'compact') {
    return (
      <div className={`volume-compact ${supported ? '' : 'volume-compact-static'}`} style={style}>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onToggleMute();
          }}
          className={`volume-icon-button ${state === 'muted' ? 'is-muted' : ''}`}
          aria-label={muteLabel}
          title={`${muteLabel}${supported ? ` · ${percent}%` : ''}`}
        >
          <Icon className="w-4 h-4" />
        </button>
        {slider && <div className="volume-compact-track">{slider}</div>}
      </div>
    );
  }

  return (
    <section className="volume-card" style={style} aria-label="Volume">
      <div className="volume-card-head">
        <span className="volume-card-title">
          <Icon className="w-4 h-4" />
          Volume
        </span>
        <span className="volume-readout">{state === 'muted' ? 'Muted' : supported ? `${percent}%` : 'On'}</span>
      </div>
      <div className="volume-card-row">
        <button
          ref={minRef}
          type="button"
          onClick={onToggleMute}
          className={`volume-mute ${state === 'muted' ? 'is-muted' : ''}`}
          aria-label={muteLabel}
          title={`${muteLabel} (M)`}
        >
          {state === 'muted' ? <VolumeX className="w-4 h-4" /> : <Volume className="w-4 h-4" />}
        </button>
        {supported ? (
          <div ref={pillRef} className={`volume-pill ${state === 'muted' ? 'is-muted' : ''}`} onPointerDown={onPillPointerDown}>
            <div ref={trackRef} className="volume-pill-track" aria-hidden="true">
              <div className="volume-pill-fill" />
            </div>
            <span className="volume-pill-bubble" aria-hidden="true">{percent}</span>
            {slider}
          </div>
        ) : (
          <p className="volume-hint">Use your device volume buttons</p>
        )}
        {supported && (
          <button
            ref={maxRef}
            type="button"
            onClick={() => onChange(1)}
            className="volume-max"
            aria-label="Full volume"
            title="Full volume"
          >
            <Volume2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </section>
  );
}
