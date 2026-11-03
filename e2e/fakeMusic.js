// A small, predictable stand-in for the music services the app talks to
// (JioSaavn API, Audius, iTunes search) plus silent audio and blank cover art,
// so the browser tests check MoodTune itself rather than someone else's uptime.

const LANGUAGES = ['hindi', 'english', 'gujarati', 'punjabi', 'instrumental'];
const capitalize = (word) => word.charAt(0).toUpperCase() + word.slice(1);

export const fakeTitle = (language, n) => `Test ${capitalize(language)} Song ${n}`;
// Mixes are shuffled, so match any song of a language rather than a specific one.
export const anyTitle = (language) => new RegExp(`Test ${capitalize(language)} Song \\d`);

function fakeSong(language, n, title = fakeTitle(language, n)) {
  const id = `${language}-${n}-${title.replace(/\W+/g, '').toLowerCase()}`;
  return {
    id,
    name: title,
    type: 'song',
    language,
    duration: 180 + n,
    playCount: 1000 - n,
    year: '2026',
    url: `https://www.jiosaavn.com/song/${id}`,
    album: { id: `album-${language}`, name: `${capitalize(language)} Test Album` },
    artists: { primary: [{ id: `artist-${language}`, name: `${capitalize(language)} Test Artist` }] },
    image: [{ quality: '500x500', url: `https://c.saavncdn.com/test/${id}.jpg` }],
    downloadUrl: [{ quality: '160kbps', url: `https://aac.saavncdn.com/test/${id}.mp4` }],
  };
}

const songsFor = (language, count = 8) => Array.from({ length: count }, (_, i) => fakeSong(language, i + 1));
const languageIn = (text = '') => LANGUAGES.find((lang) => text.toLowerCase().includes(lang)) || 'english';

function saavnResponse(url) {
  const path = url.pathname.replace(/^\/api/, '');
  const query = url.searchParams.get('query') || '';

  if (path === '/search/playlists') {
    const language = languageIn(query);
    return { results: [{ id: `pl-${language}`, name: `${capitalize(language)} Test Mix`, language, url: `https://www.jiosaavn.com/featured/${language}` }] };
  }
  if (path === '/playlists') {
    const language = languageIn(url.searchParams.get('link'));
    return { name: `${capitalize(language)} Test Mix`, songs: songsFor(language) };
  }
  if (path === '/search/songs') {
    // Searches by title return songs named after the term so search results are easy to assert.
    const known = LANGUAGES.some((lang) => query.toLowerCase().includes(lang));
    const songs = known
      ? songsFor(languageIn(query))
      : Array.from({ length: 5 }, (_, i) => fakeSong('english', i + 1, `${query} ${i + 1}`));
    return { results: songs };
  }
  if (path === '/search/artists') return { results: [] };
  if (path === '/albums') return { songs: songsFor('english', 4) };
  if (/\/songs\/[^/]+\/suggestions/.test(path)) return songsFor('english', 6);
  if (/\/artists\/[^/]+\/songs/.test(path)) return { songs: songsFor('english', 6) };
  return { results: [] };
}

// 1 second of 8 kHz mono silence; enough for <audio> to load, play and report a duration.
function silentWav(seconds = 1, rate = 8000) {
  const samples = seconds * rate;
  const buffer = Buffer.alloc(44 + samples, 0x80);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + samples, 4);
  buffer.write('WAVEfmt ', 8);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(rate, 24);
  buffer.writeUInt32LE(rate, 28);
  buffer.writeUInt16LE(1, 32);
  buffer.writeUInt16LE(8, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(samples, 40);
  return buffer;
}

const PIXEL_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==', 'base64');
const json = (body) => ({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });

// Route every non-local request: known music APIs get fake data, everything else is blocked
// (fonts and other third parties fall back gracefully, and nothing leaks out of the test).
export async function useFakeMusic(page) {
  const audio = silentWav();
  await page.route((url) => url.hostname !== 'localhost', (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === 'saavn.sumit.co') return route.fulfill(json({ success: true, data: saavnResponse(url) }));
    if (url.hostname === 'api.audius.co') return route.fulfill(json({ data: [] }));
    if (url.hostname === 'itunes.apple.com') return route.fulfill(json({ resultCount: 0, results: [] }));
    if (url.hostname === 'aac.saavncdn.com') return route.fulfill({ status: 200, contentType: 'audio/wav', body: audio });
    if (url.hostname === 'c.saavncdn.com') return route.fulfill({ status: 200, contentType: 'image/png', body: PIXEL_PNG });
    return route.abort();
  });
}
