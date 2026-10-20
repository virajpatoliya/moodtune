import { Volume, Volume1, Volume2, VolumeX } from 'lucide-react';
import { volumeLevel } from './volume.js';

const ICONS = { muted: VolumeX, low: Volume, medium: Volume1, high: Volume2 };

export function VolumeIcon({ level, muted, className }) {
  const Icon = ICONS[volumeLevel(level, muted)];
  return <Icon className={className} />;
}

export default function VolumeControl({ level, muted, supported, accent, onChange, onToggleMute, variant = 'full' }) {
  const state = volumeLevel(level, muted);
  const Icon = ICONS[state];
  const percent = muted ? 0 : Math.round(level * 100);
  const style = { '--vol-fill': `${percent}%`, '--vol-a': accent[0], '--vol-b': accent[1] };
  const muteLabel = state === 'muted' ? 'Unmute' : 'Mute';

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
          type="button"
          onClick={onToggleMute}
          className={`volume-mute ${state === 'muted' ? 'is-muted' : ''}`}
          aria-label={muteLabel}
          title={`${muteLabel} (M)`}
        >
          {state === 'muted' ? <VolumeX className="w-4 h-4" /> : <Volume className="w-4 h-4" />}
        </button>
        {supported ? <div className="volume-wedge">{slider}</div> : <p className="volume-hint">Use your device volume buttons</p>}
        {supported && (
          <button
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
