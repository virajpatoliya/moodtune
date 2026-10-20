export function locationKey(location) {
  return [location.screen, location.screen === 'quiz' ? location.step : '', location.player ? 'player' : '', location.mood ? 'mood' : '', location.search ? 'search' : '', location.vibe ? 'vibe' : ''].join('|');
}

const OVERLAYS = ['player', 'mood', 'search', 'vibe'];

export function planHistoryUpdate(stack, index, next) {
  if (next.screen === 'analyzing') return 'none';
  const current = stack[index];
  if (!current || locationKey(current) === locationKey(next)) return 'none';
  if (index > 0 && locationKey(stack[index - 1]) === locationKey(next)) return 'back';
  // An overlay that was closed while moving elsewhere should not reopen on Back.
  return OVERLAYS.some((overlay) => current[overlay] && !next[overlay]) ? 'replace' : 'push';
}
