import { useEffect, useRef, useState } from 'react';
import { Pause, Play, SkipForward } from 'lucide-react';

const PARTICLES = Array.from({ length: 24 }, (_, index) => ({
  left: `${(index * 37) % 100}%`,
  delay: `${-((index * 1.7) % 9).toFixed(1)}s`,
  duration: `${6 + ((index * 13) % 7)}s`,
  size: `${2 + (index % 4)}px`,
}));

const SOURCE_LABEL = { style: 'from the song’s style', genre: 'from the song’s genre', mood: 'from your mood' };

function formatClock(date) {
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export default function VibeScreen({ song, coverUrl, theme, isPlaying, progress, duration, onTogglePlay, onNext, onClose }) {
  const rootRef = useRef(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const previousFocus = document.activeElement;
    rootRef.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    let lock = null;
    let released = false;
    async function requestLock() {
      try {
        if (document.visibilityState === 'visible' && navigator.wakeLock) {
          lock = await navigator.wakeLock.request('screen');
          if (released) lock.release();
        }
      } catch (error) {
        console.warn('Screen wake lock unavailable.', error);
      }
    }
    requestLock();
    document.addEventListener('visibilitychange', requestLock);
    return () => {
      released = true;
      lock?.release().catch(() => {});
      document.removeEventListener('visibilitychange', requestLock);
      document.body.style.overflow = overflow;
      previousFocus?.focus?.();
    };
  }, []);

  const stop = (handler) => (event) => { event.stopPropagation(); handler(); };
  const percent = duration ? Math.min(100, (progress / duration) * 100) : 0;

  return (
    <div
      ref={rootRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label={`Vibe screen: ${song.title} by ${song.artist}. Tap anywhere or press Escape to return.`}
      onClick={onClose}
      onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); onClose(); } }}
      className={`vibe-screen vibe-${theme.motion} ${isPlaying ? '' : 'vibe-paused'}`}
      style={{ '--vibe-a': theme.colors[0], '--vibe-b': theme.colors[1], '--vibe-c': theme.colors[2], '--vibe-base': theme.base }}
    >
      <div className="vibe-layer" aria-hidden="true">
        {coverUrl && <img className="vibe-art" src={coverUrl} alt="" />}
        <div className="vibe-conic" />
        <span className="vibe-orb vibe-orb-a" />
        <span className="vibe-orb vibe-orb-b" />
        <span className="vibe-orb vibe-orb-c" />
        {(theme.motion === 'rain' || theme.motion === 'spark') && (
          <div className="vibe-particles">
            {PARTICLES.map((particle, index) => (
              <i key={index} style={{ left: particle.left, animationDelay: particle.delay, animationDuration: particle.duration, '--size': particle.size }} />
            ))}
          </div>
        )}
        {theme.motion === 'breathe' && <div className="vibe-breath"><span>{isPlaying ? 'Breathe in · breathe out' : 'Paused'}</span></div>}
        <div className="vibe-vignette" />
      </div>

      <div className="vibe-content">
        <div className="vibe-clock">{formatClock(now)}</div>
        <div className="vibe-now">
          <div className="vibe-cover">
            {coverUrl ? <img src={coverUrl} alt="" /> : <span style={{ background: `linear-gradient(135deg, ${theme.colors[0]}, ${theme.colors[1]})` }} />}
          </div>
          <h2 className="vibe-title">{song.title}</h2>
          <p className="vibe-artist">{song.artist}</p>
          <p className="vibe-theme">{theme.label} · {SOURCE_LABEL[theme.source]}</p>
        </div>
        <div className="vibe-bottom">
          <div className="vibe-progress" aria-hidden="true"><span style={{ width: `${percent}%` }} /></div>
          <div className="vibe-controls">
            <button type="button" aria-label={isPlaying ? 'Pause' : 'Play'} onClick={stop(onTogglePlay)} className="vibe-play">
              {isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current ml-0.5" />}
            </button>
            <button type="button" aria-label="Next song" onClick={stop(onNext)} className="vibe-next">
              <SkipForward className="w-5 h-5 fill-current" />
            </button>
          </div>
          <p className="vibe-hint">Tap anywhere to return</p>
        </div>
      </div>
    </div>
  );
}
