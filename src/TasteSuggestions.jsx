import { useEffect, useState } from 'react';
import { ArrowRight, Music, Pause, Play, RefreshCw } from 'lucide-react';
import { buildTasteMix, searchMusic } from './musicDiscovery.js';

export default function TasteSuggestions({ history, currentSongId, isPlaying, onPreview, onOpen, onClear }) {
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState({ key: '', songs: [], error: '' });
  const termsKey = JSON.stringify(history.slice(0, 3));
  const key = `${termsKey}:${revision}`;
  const loading = result.key !== key;

  useEffect(() => {
    const terms = JSON.parse(termsKey);
    if (!terms.length) return;
    const controller = new AbortController();
    let cancelled = false;
    const timeout = setTimeout(() => controller.abort(new Error('Personalized discovery timed out. Please retry.')), 15000);
    async function load() {
      try {
        const groups = await Promise.all(terms.map((term) => searchMusic(term, controller.signal)));
        if (!cancelled) setResult({ key, songs: buildTasteMix(groups, terms, revision), error: '' });
      } catch (error) {
        if (cancelled) return;
        console.error('History-based discovery failed.', error);
        setResult({ key, songs: [], error: error.message });
      } finally {
        clearTimeout(timeout);
      }
    }
    load();
    return () => { cancelled = true; clearTimeout(timeout); controller.abort(); };
  }, [termsKey, revision, key]);

  if (!history.length) return null;

  return (
    <section className="taste-suggestions border-t border-white/10 pt-6 space-y-3" aria-labelledby="taste-title">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 id="taste-title" className="text-lg sm:text-xl font-bold">A little more your style</h2>
          <p className="text-xs text-slate-400 mt-1">Inspired by your recent searches</p>
        </div>
        <button className="search-touch-button rounded-full border border-white/10 hover:bg-white/10" aria-label="Refresh suggestions" disabled={loading} onClick={() => setRevision((value) => value + 1)}>
          <RefreshCw className={`w-4 h-4 ${loading ? 'motion-safe:animate-spin' : ''}`} />
        </button>
      </div>
      {loading ? <div role="status" aria-label="Loading taste suggestions" className="taste-shelf">
        {[0, 1, 2, 3].map((index) => <div key={index} className="taste-card h-32 rounded-2xl bg-white/5 motion-safe:animate-pulse" />)}
      </div> : result.error ? <div role="alert" className="rounded-2xl border border-rose-300/20 bg-rose-500/10 p-4 text-sm">
        <p>{result.error}</p><button className="search-chip mt-3" onClick={() => setRevision((value) => value + 1)}>Retry suggestions</button>
      </div> : !result.songs.length ? <p role="status" className="text-sm text-slate-300 py-4">No preview-ready songs found from these searches. Try searching for another song or artist.</p> : (
        <div className="taste-shelf" role="region" aria-label="Personalized song suggestions" tabIndex={0}>
          {result.songs.map((song) => (
            <div key={song.id} className="taste-card rounded-2xl border border-white/10 bg-white/[0.03] p-3"
              onClick={() => onOpen(song)}>
              <div className="flex items-center justify-between gap-3 mb-3">
                <button className="taste-art" aria-label={`Open taste player for ${song.title} by ${song.artist}`}
                  onClick={(event) => { event.stopPropagation(); onOpen(song); }}>
                  {song.realCoverUrl && <img src={song.realCoverUrl} alt="" loading="lazy" onError={(event) => { event.currentTarget.hidden = true; }} />}
                  <Music className="w-6 h-6" />
                </button>
                <button className="taste-preview" aria-label={`${currentSongId === song.id && isPlaying ? 'Pause' : 'Play'} taste preview of ${song.title}`}
                  onClick={(event) => { event.stopPropagation(); onPreview(song); }}>
                  {currentSongId === song.id && isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
                </button>
              </div>
              <button className="block w-full min-w-0 text-left" aria-label={`Play and open ${song.title} by ${song.artist}`}
                onClick={(event) => { event.stopPropagation(); onOpen(song); }}>
                <span className="block text-sm font-semibold truncate">{song.title}</span>
                <span className="block text-xs text-slate-400 truncate mt-1">{song.artist}</span>
                <span className="block text-[10px] text-violet-300 truncate mt-2">From &ldquo;{song.searchTerm}&rdquo; <ArrowRight className="inline w-3 h-3" /></span>
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] text-slate-500">Preview picks from this device&apos;s history</p>
        <button className="text-xs text-slate-400 hover:text-white min-h-11 shrink-0" onClick={onClear}>Clear history</button>
      </div>
    </section>
  );
}
