import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDiscoveryMix, buildMoodSuggestions, buildRadioQueue, buildRelatedMix, buildTasteMix, discoveryQueries, moodDiscoverySeeds, moodSuggestionQuery, normalizeTracks, prioritizeFreshSongs, RADIO_MIN_SONGS, radioFillQueries, relatedQueries, resolveMoodMix, searchMusic, searchMusicBatch, upcomingTracks } from './musicDiscovery.js';
import { MOOD_CATALOG } from './moodCatalog.js';

const curated = [
  { title: 'Dance', artist: 'Singer A', language: 'Hindi', moods: ['happy', 'motivated'], intents: ['match', 'uplift', 'energetic'] },
  { title: 'Quiet', artist: 'Singer B', language: 'Hindi', moods: ['calm', 'stressed'], intents: ['match', 'relax'] },
  { title: 'Reflect', artist: 'Singer C', language: 'Hindi', moods: ['sad'], intents: ['match', 'meaningful'] },
  { title: 'Love', artist: 'Singer D', language: 'Hindi', moods: ['romantic'], intents: ['match'] },
];

test('listening goals override conflicting mood without mixing the old mood back in', () => {
  for (const mood of ['happy', 'calm', 'sad', 'stressed', 'romantic', 'motivated']) {
    for (const [intent, title] of [['relax', 'Quiet'], ['uplift', 'Dance'], ['energetic', 'Dance'], ['meaningful', 'Reflect']]) {
      assert.deepEqual(moodDiscoverySeeds(curated, { mood, intent, language: 'Hindi' }).map((song) => song.title), [title]);
    }
  }
  assert.deepEqual(discoveryQueries('happy', 'relax', 'Hindi'), discoveryQueries('sad', 'relax', 'Hindi'));
  assert.equal(moodDiscoverySeeds(curated, { mood: 'romantic', intent: 'match', language: 'Hindi' })[0].title, 'Love');
});

test('seed selection covers mood/goal/language combinations and balances Surprise', () => {
  const languages = ['Hindi', 'English', 'Gujarati', 'Punjabi', 'Instrumental'];
  const catalog = languages.flatMap((language) => curated.map((song) => ({ ...song, title: `${song.title} ${language}`, language })));
  for (const mood of ['happy', 'calm', 'sad', 'stressed', 'romantic', 'motivated']) {
    for (const intent of ['match', 'uplift', 'relax', 'energetic', 'meaningful']) {
      for (const language of [...languages, 'Surprise']) {
        const seeds = moodDiscoverySeeds(catalog, { mood, intent, language });
        assert.ok(seeds.length > 0 && seeds.length <= 18);
        assert.ok(seeds.every((seed) => language === 'Surprise' || seed.language === language));
        if (language === 'Surprise') assert.equal(new Set(seeds.map((seed) => seed.language)).size, 5);
      }
    }
  }
});

test('seed refresh rotates only eligible songs and handles sparse pools honestly', () => {
  const catalog = Array.from({ length: 9 }, (_, index) => ({ ...curated[1], title: `Quiet ${index}` }));
  const preferences = { mood: 'happy', intent: 'relax', language: 'Hindi' };
  assert.equal(moodDiscoverySeeds(catalog, preferences).length, 9);
  assert.notDeepEqual(moodDiscoverySeeds(catalog, preferences), moodDiscoverySeeds(catalog, preferences, 1));
  assert.deepEqual(moodDiscoverySeeds(curated, { ...preferences, language: 'Gujarati' }), []);
  assert.deepEqual(moodDiscoverySeeds([], preferences), []);
});

test('real mood catalog has at least twelve distinct candidates for every mood, goal, and language', () => {
  for (const mood of ['happy', 'calm', 'sad', 'stressed', 'romantic', 'motivated']) {
    for (const intent of ['match', 'uplift', 'relax', 'energetic', 'meaningful']) {
      for (const language of ['Hindi', 'English', 'Gujarati', 'Punjabi', 'Instrumental', 'Surprise']) {
        const seeds = moodDiscoverySeeds(MOOD_CATALOG, { mood, intent, language });
        assert.ok(seeds.length >= 12, `${mood}/${intent}/${language}: ${seeds.length}`);
        assert.equal(new Set(seeds.map((song) => `${song.title}:${song.artist}`)).size, seeds.length);
      }
    }
  }
});

test('refresh advances a full shelf and seed resolution checks beyond the first six', () => {
  const catalog = Array.from({ length: 24 }, (_, index) => ({ ...curated[1], title: `Quiet ${index}` }));
  const preferences = { mood: 'happy', intent: 'relax', language: 'Hindi' };
  const first = moodDiscoverySeeds(catalog, preferences);
  const next = moodDiscoverySeeds(catalog, preferences, 1, first.slice(0, 6).map((song) => song.title));
  assert.equal(first.length, 18);
  assert.ok(next.slice(0, 6).every((song) => !first.slice(0, 6).some((previous) => previous.title === song.title)));
  const results = first.map((seed, index) => index < 6 ? [] : [{
    trackId: index + 1, trackName: seed.title, artistName: seed.artist, previewUrl: `https://example.com/${index}`,
  }]);
  assert.equal(resolveMoodMix(results, first, preferences).length, 12);
});

test('fresh selection avoids repeats across consecutive refreshes before cycling oldest songs', () => {
  const songs = Array.from({ length: 18 }, (_, index) => ({ title: `Song ${index}` }));
  let seen = [];
  const batches = [];
  for (let round = 0; round < 4; round++) {
    const picks = prioritizeFreshSongs(songs, seen, 6);
    batches.push(picks.map((song) => song.title));
    seen = [...seen, ...picks.map((song) => song.title)];
  }
  assert.equal(new Set(batches.slice(0, 3).flat()).size, 18);
  assert.deepEqual(batches[3], batches[0]);
  const ranked = [...songs.slice(0, 6), ...songs.slice(6)];
  assert.ok(prioritizeFreshSongs(ranked, batches[0], 6).every((song) => !batches[0].includes(song.title)));
  assert.deepEqual(prioritizeFreshSongs([{ title: 'Song 0 (From "Film")' }, { title: 'New song' }], ['Song 0'], 1), [{ title: 'New song' }]);
});

test('twelve-song pools do not repeat the same shelf on refresh', () => {
  const catalog = Array.from({ length: 12 }, (_, index) => ({ ...curated[1], title: `Quiet ${index}` }));
  const preferences = { mood: 'calm', intent: 'relax', language: 'Hindi' };
  const first = moodDiscoverySeeds(catalog, preferences).slice(0, 6);
  const next = moodDiscoverySeeds(catalog, preferences, 1, first.map((song) => song.title)).slice(0, 6);
  assert.equal(new Set([...first, ...next].map((song) => song.title)).size, 12);
});

test('artist suggestions are independent of leftover mood picks, exclude duplicates, and refresh', () => {
  const seed = { id: 'itunes-1', title: 'Quiet', artist: 'Singer B', genre: 'Pop' };
  const group = Array.from({ length: 12 }, (_, index) => ({
    trackId: index + 1, trackName: index === 0 ? 'Quiet' : `Related ${index}`,
    artistName: 'Singer B', primaryGenreName: 'Pop', previewUrl: `https://example.com/${index}`,
  }));
  group.push({ ...group[2], trackId: 99, artistName: 'Singer B & Singer C' }, { ...group[3], trackId: 100, artistName: 'Unrelated' });
  const first = buildMoodSuggestions([group], [seed], [seed]);
  assert.equal(first.length, 6);
  assert.equal(new Set(first.map((song) => song.title)).size, 6);
  assert.ok(first.every((song) => song.title !== seed.title && song.artist.split(' & ').includes(seed.artist)));
  assert.ok(first.every((song) => song.language === 'Global' && song.moods[0] === null));
  assert.notDeepEqual(buildMoodSuggestions([group], [seed], [seed], 6), first);
  const fresh = buildMoodSuggestions([group], [seed], [seed], 1, first.map((song) => song.title));
  assert.equal(fresh.filter((song) => first.some((previous) => previous.title === song.title)).length, 1);
  assert.deepEqual(buildMoodSuggestions([[]], [seed], [seed]), []);
  assert.equal(moodSuggestionQuery({ ...seed, artist: 'Singer B, Singer C & Singer D' }), 'singer b');
  assert.equal(moodSuggestionQuery({ ...seed, title: 'Garba', artist: 'Singer B & Singer C' }), 'singer b garba dandiya');
  assert.deepEqual(buildMoodSuggestions([[{ ...group[2], trackName: 'Lo-fi cover' }]], [seed], [seed]), []);
});

test('mood resolution accepts only curated recordings, preserves their language/tags, and needs previews', () => {
  const track = (id, title, artist = 'Singer B') => ({
    trackId: id, trackName: title, artistName: artist, previewUrl: `https://example.com/${id}`,
  });
  const results = [
    track(1, 'Unrelated'), track(2, 'Quiet', 'Unrelated singer'),
    track(3, 'Quiet (Remix)'), track(4, 'Quiet (Sad Version)'),
    track(5, 'Quiet (Instrumental)'), track(6, 'Quiet (Live)'),
    { ...track(7, 'Quiet'), previewUrl: undefined },
    track(8, 'Quiet (From "A Film")'),
  ];
  const songs = resolveMoodMix([results], [curated[1]], { mood: 'happy', intent: 'relax' });
  assert.deepEqual(songs.map((song) => song.id), ['itunes-8']);
  assert.equal(songs[0].language, 'Hindi');
  assert.deepEqual(songs[0].moods, ['calm', 'stressed']);
  assert.ok(songs[0].baseReason.includes('unwinding'));
  assert.equal(songs[0].bpm, undefined);
  assert.equal(songs[0].audioFallback, undefined);
  assert.deepEqual(resolveMoodMix([results.slice(0, 7)], [curated[1]], { mood: 'happy', intent: 'relax' }), []);
});

test('recording matching tolerates artist punctuation but not similarly named artists', () => {
  const seed = { ...curated[2], artist: 'B Praak' };
  const item = { trackId: 1, trackName: 'Reflect', artistName: 'B. Praak & Another Artist', previewUrl: 'https://example.com/1' };
  assert.equal(resolveMoodMix([[item]], [seed], { mood: 'sad', intent: 'match' }).length, 1);
  assert.equal(resolveMoodMix([[{ ...item, artistName: 'B Praak Tribute Band' }]], [seed], { mood: 'sad', intent: 'match' }).length, 0);
  assert.equal(resolveMoodMix([[item], [item]], [seed, seed], { mood: 'sad', intent: 'match' }).length, 1);
});

test('discovery queries respond to mood, intent, language, and refresh', () => {
  const base = discoveryQueries('calm', 'match', 'Hindi');
  assert.ok(base.every((query) => query.startsWith('Hindi ')));
  assert.notDeepEqual(base, discoveryQueries('happy', 'match', 'Hindi'));
  assert.notDeepEqual(base, discoveryQueries('calm', 'energetic', 'Hindi'));
  assert.notDeepEqual(base, discoveryQueries('calm', 'match', 'English'));
  assert.notDeepEqual(base, discoveryQueries('calm', 'match', 'Hindi', 1));
  assert.ok(discoveryQueries('calm', 'relax', 'Instrumental').every((query) => query.startsWith('instrumental ')));
  assert.ok(discoveryQueries('calm', 'relax', 'Surprise').every((query) => !query.includes('Surprise')));
});

test('normalization deduplicates and includes only preview-ready tracks without invented audio metrics', () => {
  const track = { trackId: 1, trackName: 'Test song', artistName: 'Artist', previewUrl: 'https://example.com/preview', artworkUrl100: 'https://example.com/100x100bb.jpg' };
  const songs = normalizeTracks([track, track, { trackId: 2, trackName: 'No preview' }], { mood: 'happy', intent: 'match', language: 'Hindi' });
  assert.equal(songs.length, 1);
  assert.equal(songs[0].id, 'itunes-1');
  assert.deepEqual(songs[0].moods, ['happy']);
  assert.equal(songs[0].language, 'Hindi');
  assert.equal(songs[0].bpm, undefined);
  assert.equal(songs[0].energy, undefined);
  assert.ok(songs[0].realCoverUrl.includes('480x480bb'));
});

test('search encodes input and forwards cancellation', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(new URL(url).searchParams.get('term'), 'love & peace');
    assert.ok(options.signal instanceof AbortSignal);
    return { ok: true, json: async () => ({ results: [{ trackId: 1 }] }) };
  });
  assert.deepEqual(await searchMusic('love & peace', new AbortController().signal), [{ trackId: 1 }]);
});

test('discovery balances query sources and prioritizes artist variety without dropping tracks', () => {
  const track = (id, artist) => ({ trackId: id, trackName: `Song ${id}`, artistName: artist, previewUrl: 'https://example.com/preview' });
  const songs = buildDiscoveryMix([
    [track(1, 'Artist A'), track(2, 'Artist A'), track(3, 'Artist B')],
    [track(4, 'Artist C'), track(5, 'Artist D')],
  ], { mood: 'calm', intent: 'relax' });
  assert.deepEqual(songs.map((song) => song.id), ['itunes-1', 'itunes-4', 'itunes-5', 'itunes-3', 'itunes-2']);
  assert.equal(new Set(songs.slice(0, 4).map((song) => song.artist)).size, 4);
  const duplicates = normalizeTracks([track(1, 'Artist A'), { ...track(1, 'Artist A'), trackId: 99 }], { mood: 'calm', intent: 'relax' });
  assert.equal(duplicates.length, 1);
  const covers = buildDiscoveryMix([[
    track(1, 'Artist A'),
    { ...track(2, 'Artist B'), trackName: 'Song 1 (Acoustic)' },
    track(3, 'Artist C'),
  ]], { mood: 'calm', intent: 'relax' });
  assert.deepEqual(covers.map((song) => song.id), ['itunes-1', 'itunes-3', 'itunes-2']);
  assert.deepEqual(buildDiscoveryMix([], { mood: 'calm', intent: 'relax' }), []);
});

test('search surfaces HTTP and malformed-response errors', async (t) => {
  const mock = t.mock.method(globalThis, 'fetch', async () => ({ ok: false, status: 500 }));
  await assert.rejects(searchMusic('test'), /HTTP 500/);
  mock.mock.mockImplementation(async () => ({ ok: true, json: async () => ({}) }));
  await assert.rejects(searchMusic('test'), /invalid response/);
});

test('successful searches are cached but cancelled requests and failures are not hidden', async (t) => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    calls++;
    return { ok: true, json: async () => ({ results: [{ trackId: 123 }] }) };
  });
  await searchMusic('cache regression');
  await searchMusic(' CACHE   REGRESSION ');
  assert.equal(calls, 1);
  const controller = new AbortController();
  controller.abort(new Error('Cancelled'));
  await assert.rejects(searchMusic('cache regression', controller.signal), /Cancelled/);
});

test('batch discovery retains successful searches with an explicit partial error and rejects total failure', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url) => new URL(url).searchParams.get('term').includes('fail')
    ? { ok: false, status: 500 }
    : { ok: true, json: async () => ({ results: [{ trackId: 456 }] }) });
  const result = await searchMusicBatch(['batch good', 'batch fail']);
  assert.deepEqual(result.groups, [[{ trackId: 456 }], []]);
  assert.match(result.error, /1 music searches.*HTTP 500/);
  await assert.rejects(searchMusicBatch(['batch fail']), /HTTP 500/);
});

test('song radio follows current-song metadata instead of mood or search history', () => {
  const seed = { id: 'itunes-1', title: 'Seed', artist: 'Artist A', genre: 'Indian Pop' };
  const queries = relatedQueries(seed, 'calm', 'match', 'Hindi');
  assert.equal(queries[0], 'Artist A');
  assert.equal(queries[1], 'Artist A Indian Pop');
  assert.deepEqual(queries, relatedQueries(seed, 'happy', 'match', 'Hindi'));
  assert.deepEqual(queries, relatedQueries(seed, 'calm', 'match', 'English'));
  assert.deepEqual(relatedQueries({ ...seed, genre: null }), ['Artist A']);
});

test('song radio excludes the seed and alternate recordings, deduplicates, and retains genre', () => {
  const track = (id, title, artist) => ({
    trackId: id, trackName: title, artistName: artist,
    primaryGenreName: 'Pop', previewUrl: `https://example.com/${id}`,
  });
  const seed = { id: 'itunes-1', title: 'Seed', artist: 'Artist A' };
  const a = track(2, 'Other song', 'Artist A');
  const b = track(3, 'Another song', 'Artist A');
  const songs = buildRelatedMix([
    [track(1, 'Seed', 'Artist A'), a, track(4, 'Seed (Acoustic)', 'Artist C')],
    [b, a, { trackId: 5, trackName: 'No preview' }],
  ], seed, { mood: 'calm', intent: 'match' });
  assert.deepEqual(new Set(songs.map((song) => song.id)), new Set(['itunes-2', 'itunes-3']));
  assert.ok(songs.every((song) => song.genre === 'Pop' && song.language === 'Global' && song.matchWhy.includes('Seed')));
  assert.deepEqual(buildRelatedMix([], seed, { mood: 'calm', intent: 'match' }), []);
});

test('Garba radio excludes unrelated songs, even by the same artist or broad genre', () => {
  const seed = { id: 'itunes-1', title: 'Navratri Garba', artist: 'Singer', album: 'Garba Hits', genre: 'Indian Pop' };
  const track = (id, title, album, artist = 'Singer') => ({
    trackId: id, trackName: title, collectionName: album, artistName: artist,
    primaryGenreName: 'Indian Pop', previewUrl: `https://example.com/${id}`,
  });
  assert.deepEqual(relatedQueries(seed), ['Singer garba dandiya', 'garba dandiya']);
  const songs = buildRelatedMix([[
    track(2, 'Love Song', 'Romantic Hits'),
    track(3, 'Dholida', 'Nonstop Garba'),
    track(4, 'Dandiya Nights', 'Dance', 'Another Singer'),
    track(5, 'Bhajan', 'Devotional'),
    track(6, 'ગરબો', 'Gujarati', 'Gujarati Singer'),
  ]], seed, {});
  assert.deepEqual(new Set(songs.map((song) => song.id)), new Set(['itunes-3', 'itunes-4', 'itunes-6']));
  assert.ok(songs.every((song) => song.matchWhy.includes('Garba / Dandiya')));
  assert.deepEqual(buildRelatedMix([[track(2, 'Love Song', 'Romantic Hits')]], seed, {}), []);
});

test('generic radio requires a shared artist and matching genre when available', () => {
  const seed = { id: 'itunes-1', title: 'Seed', artist: 'Artist A & Artist B', genre: 'Pop' };
  const track = (id, artist, genre) => ({
    trackId: id, trackName: `Song ${id}`, artistName: artist, primaryGenreName: genre,
    previewUrl: `https://example.com/${id}`,
  });
  const songs = buildRelatedMix([[
    track(2, 'Artist A', 'Pop'),
    track(3, 'Artist B, Artist C', 'Pop'),
    track(4, 'Artist ABC', 'Pop'),
    track(5, 'Artist A', 'Devotional'),
    track(6, 'Unrelated Artist', 'Pop'),
  ]], seed, {});
  assert.deepEqual(songs.map((song) => song.id), ['itunes-2', 'itunes-3']);
});

test('radio queue fills to at least 15 in priority order: song, artist, genre, mood, search', () => {
  const seed = { id: 'itunes-1', title: 'Seed', artist: 'Artist A & Artist B', genre: 'Bollywood', language: 'Hindi' };
  const track = (id, artist, genre, title = `Song ${id}`) => ({
    trackId: id, trackName: title, artistName: artist, primaryGenreName: genre, previewUrl: `https://example.com/${id}`,
  });
  const strict = [[track(2, 'Artist A', 'Bollywood'), track(3, 'Artist A', 'Bollywood')]];
  const fill = [[track(4, 'Artist B', 'Indian Pop'), track(5, 'Other', 'Bollywood'), track(6, 'Other 2', 'Bollywood'),
    track(7, 'Other 3', 'Rock'), track(8, 'Garba Star', 'Bollywood', 'Navratri Garba')]];
  const moodSongs = Array.from({ length: 12 }, (_, i) => ({ id: `mood-${i}`, title: `Mood ${i}`, artist: `Mood Artist ${i}`, genre: i === 11 ? 'Bollywood' : 'Pop' }));
  const search = [[track(30, 'Searched', 'Bollywood'), track(31, 'Searched', 'Metal')]];
  const queue = buildRadioQueue(seed, { strictGroups: strict, fillGroups: fill, searchGroups: search, searchTerms: ['old search'], moodSongs, moodLabel: 'happy', excludeIds: ['mood-0'] });
  const ids = queue.map((song) => song.id);
  assert.ok(queue.length >= RADIO_MIN_SONGS && queue.length <= 20);
  assert.deepEqual(ids.slice(0, 6), ['itunes-2', 'itunes-3', 'itunes-4', 'itunes-5', 'itunes-6', 'mood-11']);
  assert.ok(!ids.includes('itunes-7') && !ids.includes('itunes-8') && !ids.includes('itunes-31') && !ids.includes('mood-0'));
  assert.equal(new Set(ids).size, ids.length);
  assert.match(queue.find((song) => song.id === 'mood-1').matchWhy, /happy mood mix/);
  assert.deepEqual(radioFillQueries(seed), ['artist b', 'artist a Bollywood hits', 'Hindi Bollywood']);
});

test('styled radio fills only with the same style and never with mood filler', () => {
  const seed = { id: 'itunes-1', title: 'Navratri Garba', artist: 'Singer', genre: 'Indian Pop' };
  const track = (id, title) => ({ trackId: id, trackName: title, artistName: `Artist ${id}`, primaryGenreName: 'Indian Pop', previewUrl: `https://example.com/${id}` });
  const fill = [Array.from({ length: 25 }, (_, i) => track(i + 10, i % 5 === 0 ? `Love Song ${i}` : `Garba ${i}`))];
  const queue = buildRadioQueue(seed, { fillGroups: fill, moodSongs: [{ id: 'mood', title: 'Mood', artist: 'X', genre: 'Indian Pop' }] });
  assert.ok(queue.length >= RADIO_MIN_SONGS);
  assert.ok(queue.every((song) => /Garba/.test(song.title)));
  assert.ok(radioFillQueries(seed).includes('navratri garba'));
});

test('visible upcoming queue matches playback order, wraps, and never repeats the current track', () => {
  const tracks = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  assert.deepEqual(upcomingTracks(tracks, 'b'), [{ id: 'c' }, { id: 'a' }]);
  assert.deepEqual(upcomingTracks(tracks, 'c'), [{ id: 'a' }, { id: 'b' }]);
  assert.deepEqual(upcomingTracks(tracks, 'not-in-pool'), tracks);
  assert.deepEqual(upcomingTracks([{ id: 'a' }], 'a'), []);
  assert.deepEqual(upcomingTracks([], 'a'), []);
});

test('taste suggestions blend search sources, deduplicate, and include the actual search reason', () => {
  const track = (id) => ({ trackId: id, trackName: `Song ${id}`, artistName: `Artist ${id}`, previewUrl: `https://example.com/${id}` });
  const groups = [[track(1), track(2), track(3)], [track(4), track(1), track(5)], [track(6), track(7), track(8)]];
  const terms = ['Ilahi', 'Kasoor', 'Arijit Singh'];
  const songs = buildTasteMix(groups, terms);
  assert.equal(songs.length, 6);
  assert.equal(new Set(songs.map((song) => song.id)).size, 6);
  assert.deepEqual(songs.slice(0, 3).map((song) => song.searchTerm), terms);
  assert.ok(songs.every((song) => song.matchWhy.includes(song.searchTerm) && song.language === 'Global'));
  assert.notDeepEqual(songs.map((song) => song.id), buildTasteMix(groups, terms, 1).map((song) => song.id));
  assert.deepEqual(buildTasteMix([[], [], []], terms), []);
  assert.deepEqual(buildTasteMix([], []), []);
});
