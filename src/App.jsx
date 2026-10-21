import { useState, useEffect, useRef, useMemo, useCallback, useSyncExternalStore } from 'react';
import { discoveryQueries, prioritizeFreshSongs, RADIO_MIN_SONGS, upcomingTracks } from './musicDiscovery';
import { fetchOpenMoodMix, fetchOpenRadio, fetchOpenSuggestions, searchOpenMusic } from './openMusic.js';
import { fetchSaavnMoodMix, fetchSaavnRadio, fetchSaavnSuggestions, searchSaavn } from './saavn.js';
import './App.css';
import TasteSuggestions from './TasteSuggestions.jsx';
import { addSearchTerm, readSearchHistory, SEARCH_HISTORY_KEY } from './searchHistory.js';
import { planHistoryUpdate } from './appHistory.js';
import VolumeControl, { VolumeIcon } from './VolumeControl.jsx';
import { canSetVolume, MOOD_ACCENTS, readVolume, saveVolume, setLevel, toGain, toggleMute, VOLUME_STEP } from './volume.js';
import TargetCursor from './components/reactbits/TargetCursor.jsx';
import ClickSpark from './components/reactbits/ClickSpark.jsx';
import Magnet from './components/reactbits/Magnet.jsx';
import TiltedCard from './components/reactbits/TiltedCard.jsx';
import ShinyText from './components/reactbits/ShinyText.jsx';
import GradientText from './components/reactbits/GradientText.jsx';
import Aurora from './components/reactbits/Aurora.jsx';
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Heart,
  ThumbsDown,
  Sparkles,
  Music,
  Sliders,
  Volume2,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  RefreshCw,
  Compass,
  Check,
  Search,
  ListMusic,
  X,
  Repeat,
  Shuffle,
  Clock,
  ArrowRight
} from 'lucide-react';

const MOOD_PROFILES = [
  {
    id: 'happy',
    label: 'Happy & Energetic',
    shortLabel: 'Happy & Energetic',
    subtitle: 'High spirits, radiant beats, dopamine boosts & dance rhythms',
    vibeTag: 'Uplifting & Bright',
    gradient: 'from-amber-500/25 via-orange-500/20 to-rose-500/15',
    cardGradient: 'from-amber-500 to-rose-500',
    borderGlow: 'border-amber-400/35',
    bgGlow: 'rgba(245, 158, 11, 0.22)'
  },
  {
    id: 'calm',
    label: 'Calm & Peaceful',
    shortLabel: 'Calm & Peaceful',
    subtitle: 'Tranquil acoustics, slow heartbeats, gentle breeze & quiet mind',
    vibeTag: 'Peaceful Serenity',
    gradient: 'from-emerald-500/25 via-teal-500/20 to-cyan-600/15',
    cardGradient: 'from-emerald-400 to-teal-600',
    borderGlow: 'border-emerald-400/35',
    bgGlow: 'rgba(16, 185, 129, 0.22)'
  },
  {
    id: 'sad',
    label: 'Sad & Reflective',
    shortLabel: 'Sad & Reflective',
    subtitle: 'Cathartic soul ballads, melancholic strings & comforting warmth',
    vibeTag: 'Soulful & Tender',
    gradient: 'from-indigo-600/30 via-blue-700/20 to-slate-900/40',
    cardGradient: 'from-indigo-500 to-purple-600',
    borderGlow: 'border-indigo-400/35',
    bgGlow: 'rgba(99, 102, 241, 0.25)'
  },
  {
    id: 'stressed',
    label: 'Stressed & Overwhelmed',
    shortLabel: 'Stressed & Overwhelmed',
    subtitle: 'Nervous system reset, slow ambient frequencies & mental detox',
    vibeTag: 'Gentle Mind Reset',
    gradient: 'from-teal-600/25 via-cyan-700/20 to-slate-900/40',
    cardGradient: 'from-teal-400 to-indigo-600',
    borderGlow: 'border-teal-400/35',
    bgGlow: 'rgba(20, 184, 166, 0.22)'
  },
  {
    id: 'romantic',
    label: 'Romantic & Dreamy',
    shortLabel: 'Romantic & Dreamy',
    subtitle: 'Velvet acoustics, intimate late-night confessions & sweet glow',
    vibeTag: 'Warm & Intimate',
    gradient: 'from-rose-500/30 via-pink-600/20 to-purple-800/20',
    cardGradient: 'from-rose-500 to-amber-500',
    borderGlow: 'border-rose-400/35',
    bgGlow: 'rgba(244, 63, 94, 0.24)'
  },
  {
    id: 'motivated',
    label: 'Motivated & Focused',
    shortLabel: 'Motivated & Focused',
    subtitle: 'Relentless pulse, peak workout drive & crisp flow state',
    vibeTag: 'Relentless Drive',
    gradient: 'from-cyan-500/25 via-blue-600/20 to-violet-800/20',
    cardGradient: 'from-cyan-400 to-blue-600',
    borderGlow: 'border-cyan-400/35',
    bgGlow: 'rgba(6, 182, 212, 0.24)'
  }
];

const MOOD_AURORA_COLORS = {
  happy: ['#f59e0b', '#f43f5e', '#fbbf24'],
  calm: ['#10b981', '#14b8a6', '#06b6d4'],
  sad: ['#6366f1', '#8b5cf6', '#38bdf8'],
  stressed: ['#14b8a6', '#06b6d4', '#6366f1'],
  romantic: ['#f43f5e', '#ec4899', '#f59e0b'],
  motivated: ['#06b6d4', '#3b82f6', '#8b5cf6']
};

const MOOD_SPARK_COLORS = {
  happy: ['#f59e0b', '#fbbf24', '#f43f5e', '#ffffff'],
  calm: ['#10b981', '#14b8a6', '#38bdf8', '#ffffff'],
  sad: ['#818cf8', '#c084fc', '#38bdf8', '#ffffff'],
  stressed: ['#2dd4bf', '#38bdf8', '#a78bfa', '#ffffff'],
  romantic: ['#f43f5e', '#fb7185', '#fbbf24', '#ffffff'],
  motivated: ['#06b6d4', '#3b82f6', '#a855f7', '#ffffff']
};

const INTENT_PROFILES = [
  {
    id: 'match',
    label: 'Match my current mood',
    shortLabel: 'Match Vibe',
    desc: 'Lean into exactly how you feel and stay in this emotional pocket.'
  },
  {
    id: 'uplift',
    label: 'Make me feel better / Lift me up',
    shortLabel: 'Uplift Spirits',
    desc: 'Gentle harmonic lift with encouraging rhythms to raise your vibration.'
  },
  {
    id: 'relax',
    label: 'Something relaxing & slow',
    shortLabel: 'Deep Chill',
    desc: 'Softer tempos, warm instruments, and room for deep, unhurried breaths.'
  },
  {
    id: 'energetic',
    label: 'Something high-energy & upbeat',
    shortLabel: 'High Energy',
    desc: 'Fast drums, energetic hooks, and relentless momentum.'
  },
  {
    id: 'meaningful',
    label: 'Something deep & meaningful',
    shortLabel: 'Lyrical Depth',
    desc: 'Poetic lyricism, nuanced arrangements, and stories that touch the heart.'
  }
];

const LANGUAGE_PROFILES = [
  { id: 'Hindi', label: 'Hindi / Bollywood', badge: 'Hindi', sub: 'Soulful Bollywood hits, indie singer-songwriters & cinematic anthems' },
  { id: 'English', label: 'English Pop / Indie', badge: 'English', sub: 'Global chart-toppers, alt-indie acoustic & modern groove' },
  { id: 'Gujarati', label: 'Gujarati Folk & Pop', badge: 'Gujarati', sub: 'Coastal folk-fusion, acoustic melodies & cultural rhythms' },
  { id: 'Punjabi', label: 'Punjabi Hits', badge: 'Punjabi', sub: 'Modern Punjabi grooves, soulful heartbreak & powerhouse beats' },
  { id: 'Instrumental', label: 'Instrumental', badge: 'Instrumental', sub: 'Piano melodies, atmospheric electronics & wordless listening' },
  { id: 'Surprise', label: 'Surprise me / Multilingual mix', badge: 'Multilingual', sub: 'A blend across languages, curated for your listening goal' }
];

const PUBLIC_FALLBACK_AUDIO = {
  chill: 'https://codeskulptor-demos.commondatastorage.googleapis.com/descent/background%20music.mp3',
  upbeat: 'https://codeskulptor-demos.commondatastorage.googleapis.com/pang/paza-moduless.mp3',
  fast: 'https://codeskulptor-demos.commondatastorage.googleapis.com/GalaxyInvaders/theme_01.mp3',
  ambient: 'https://commondatastorage.googleapis.com/codeskulptor-assets/Epoq-Lepidoptera.ogg'
};

const MASTER_SONGS = [
  { id: 'curated-hi-iktara', title: 'Iktara', artist: 'Kavita Seth, Amit Trivedi', language: 'Hindi', moods: ['calm', 'stressed', 'romantic'], intents: ['relax', 'meaningful', 'match'], artColors: ['#14b8a6', '#6366f1', '#0f172a'] },
  { id: 'curated-hi-zinda', title: 'Zinda', artist: 'Siddharth Mahadevan', language: 'Hindi', moods: ['motivated', 'happy'], intents: ['energetic', 'uplift', 'match'], artColors: ['#f97316', '#ef4444', '#0f172a'] },
  { id: 'curated-en-perfect', title: 'Perfect', artist: 'Ed Sheeran', language: 'English', moods: ['romantic', 'calm'], intents: ['match', 'relax', 'meaningful'], artColors: ['#f43f5e', '#8b5cf6', '#0f172a'] },
  { id: 'curated-en-bloom', title: 'Bloom', artist: 'The Paper Kites', language: 'English', moods: ['calm', 'stressed', 'romantic'], intents: ['match', 'relax'], artColors: ['#10b981', '#0ea5e9', '#0f172a'] },
  { id: 'curated-en-happy', title: 'Happy', artist: 'Pharrell Williams', language: 'English', moods: ['happy', 'motivated'], intents: ['match', 'uplift', 'energetic'], artColors: ['#f59e0b', '#ec4899', '#0f172a'] },
  { id: 'curated-gu-dhun', title: 'Dhun Laagi', artist: 'Sachin-Jigar', language: 'Gujarati', moods: ['romantic', 'calm', 'stressed'], intents: ['match', 'relax', 'meaningful'], artColors: ['#f43f5e', '#f59e0b', '#0f172a'] },
  { id: 'curated-gu-dakla', title: 'Dakla', artist: 'Aditya Gadhvi', language: 'Gujarati', moods: ['happy', 'motivated'], intents: ['match', 'uplift', 'energetic'], artColors: ['#f97316', '#e11d48', '#0f172a'] },
  { id: 'curated-pa-qismat', title: 'Qismat', artist: 'Ammy Virk', language: 'Punjabi', moods: ['sad'], intents: ['match', 'meaningful'], artColors: ['#6366f1', '#8b5cf6', '#0f172a'] },
  { id: 'curated-pa-mann', title: 'Mann Bharrya', artist: 'B Praak', language: 'Punjabi', moods: ['sad'], intents: ['match', 'meaningful'], artColors: ['#6366f1', '#ec4899', '#0f172a'] },
  { id: 'curated-pa-khaab', title: 'Khaab', artist: 'Akhil', language: 'Punjabi', moods: ['romantic', 'calm', 'stressed'], intents: ['match', 'relax'], artColors: ['#f43f5e', '#0ea5e9', '#0f172a'] },
  { id: 'curated-in-nuvole', title: 'Nuvole Bianche', artist: 'Ludovico Einaudi', language: 'Instrumental', moods: ['sad', 'calm', 'stressed', 'romantic'], intents: ['match', 'meaningful', 'relax'], artColors: ['#64748b', '#6366f1', '#0f172a'] },
  { id: 'curated-in-sunset', title: 'Sunset Lover', artist: 'Petit Biscuit', language: 'Instrumental', moods: ['happy', 'calm', 'motivated'], intents: ['match', 'uplift', 'energetic', 'relax'], artColors: ['#fb923c', '#f472b6', '#0f172a'] },
  {
    id: 'hi-1',
    title: 'Ilahi',
    artist: 'Arijit Singh, Pritam',
    album: 'Yeh Jawaani Hai Deewani',
    searchQuery: 'Ilahi Arijit Singh Yeh Jawaani Hai Deewani',
    language: 'Hindi',
    duration: 30,
    bpm: 118,
    energy: 88,
    moods: ['happy', 'motivated'],
    intents: ['match', 'uplift', 'energetic'],
    artColors: ['#f59e0b', '#ec4899', '#7c2d12'],
    audioFallback: PUBLIC_FALLBACK_AUDIO.upbeat,
    baseReason: 'Infectious wanderlust groove and soaring chorus that trigger instant feel-good dopamine.'
  },
  {
    id: 'hi-2',
    title: 'Kasoor',
    artist: 'Prateek Kuhad',
    album: 'Kasoor - Single',
    searchQuery: 'Kasoor Prateek Kuhad',
    language: 'Hindi',
    duration: 30,
    bpm: 94,
    energy: 52,
    moods: ['romantic', 'calm', 'happy'],
    intents: ['match', 'relax', 'uplift'],
    artColors: ['#fb7185', '#f59e0b', '#4c0519'],
    audioFallback: PUBLIC_FALLBACK_AUDIO.chill,
    baseReason: 'Delicate acoustic guitar fingerpicking paired with sincere vocals that embrace you with comfort.'
  },
  {
    id: 'hi-3',
    title: 'Kun Faya Kun',
    artist: 'A.R. Rahman, Mohit Chauhan, Javed Ali',
    album: 'Rockstar',
    searchQuery: 'Kun Faya Kun A.R. Rahman Rockstar',
    language: 'Hindi',
    duration: 30,
    bpm: 76,
    energy: 40,
    moods: ['calm', 'stressed', 'sad'],
    intents: ['relax', 'meaningful', 'uplift'],
    artColors: ['#10b981', '#0ea5e9', '#064e3b'],
    audioFallback: PUBLIC_FALLBACK_AUDIO.chill,
    baseReason: 'Sufi harmonies and tranquil acoustic progression designed to quiet racing thoughts and restore inner peace.'
  },
  {
    id: 'hi-4',
    title: 'Agar Tum Saath Ho',
    artist: 'Alka Yagnik, Arijit Singh',
    album: 'Tamasha',
    searchQuery: 'Agar Tum Saath Ho Alka Yagnik Arijit Singh Tamasha',
    language: 'Hindi',
    duration: 30,
    bpm: 72,
    energy: 48,
    moods: ['sad', 'romantic'],
    intents: ['match', 'meaningful'],
    artColors: ['#6366f1', '#a855f7', '#1e1b4b'],
    audioFallback: PUBLIC_FALLBACK_AUDIO.ambient,
    baseReason: 'Haunting piano progression with deeply expressive vocals that provide profound catharsis.'
  },
  {
    id: 'hi-5',
    title: 'Kar Har Maidaan Fateh',
    artist: 'Sukhwinder Singh, Shreya Ghoshal',
    album: 'Sanju',
    searchQuery: 'Kar Har Maidaan Fateh Sukhwinder Singh Sanju',
    language: 'Hindi',
    duration: 30,
    bpm: 126,
    energy: 94,
    moods: ['motivated', 'happy'],
    intents: ['energetic', 'uplift', 'match'],
    artColors: ['#06b6d4', '#3b82f6', '#0f172a'],
    audioFallback: PUBLIC_FALLBACK_AUDIO.fast,
    baseReason: 'Thunderous marching percussion and heroic vocal delivery engineered to reignite determination.'
  },
  {
    id: 'hi-6',
    title: 'Kesariya',
    artist: 'Pritam, Arijit Singh',
    album: 'Brahmastra',
    searchQuery: 'Kesariya Pritam Arijit Singh Brahmastra',
    language: 'Hindi',
    duration: 30,
    bpm: 92,
    energy: 66,
    moods: ['romantic', 'happy', 'calm'],
    intents: ['match', 'uplift', 'meaningful'],
    artColors: ['#f43f5e', '#f97316', '#881337'],
    audioFallback: PUBLIC_FALLBACK_AUDIO.chill,
    baseReason: 'Golden acoustic strings and lush choruses create an intimate, timeless romantic atmosphere.'
  },
  {
    id: 'hi-7',
    title: 'Sham',
    artist: 'Amit Trivedi, Nikhil D\'Souza',
    album: 'Aisha',
    searchQuery: 'Sham Amit Trivedi Aisha',
    language: 'Hindi',
    duration: 30,
    bpm: 82,
    energy: 55,
    moods: ['calm', 'stressed'],
    intents: ['relax', 'match', 'uplift'],
    artColors: ['#14b8a6', '#6366f1', '#134e4a'],
    audioFallback: PUBLIC_FALLBACK_AUDIO.chill,
    baseReason: 'Campfire acoustic strums and breezy whistling that dissolve everyday tension within seconds.'
  },
  {
    id: 'gu-1',
    title: 'Vhalam Aavo Ne',
    artist: 'Sachin-Jigar, Jigardan Gadhavi',
    album: 'Love Ni Bhavai',
    searchQuery: 'Vhalam Aavo Ne Jigardan Gadhavi',
    language: 'Gujarati',
    duration: 30,
    bpm: 88,
    energy: 58,
    moods: ['romantic', 'calm', 'sad'],
    intents: ['match', 'meaningful', 'relax'],
    artColors: ['#ec4899', '#f59e0b', '#500724'],
    audioFallback: PUBLIC_FALLBACK_AUDIO.chill,
    baseReason: 'Poetic Gujarati lyricism wrapped in acoustic guitars that feels like a heartfelt letter.'
  },
  {
    id: 'gu-2',
    title: 'Khalasi',
    artist: 'Aditya Gadhvi, Achint',
    album: 'Coke Studio Bharat',
    searchQuery: 'Khalasi Aditya Gadhvi Achint Coke Studio',
    language: 'Gujarati',
    duration: 30,
    bpm: 122,
    energy: 92,
    moods: ['happy', 'motivated'],
    intents: ['energetic', 'uplift', 'match'],
    artColors: ['#f59e0b', '#06b6d4', '#1e3a8a'],
    audioFallback: PUBLIC_FALLBACK_AUDIO.upbeat,
    baseReason: 'Electrifying sea voyage folk-rock with brass accents that delivers an irresistible wave of energy.'
  },
  {
    id: 'gu-3',
    title: 'Chand Ne Kaho',
    artist: 'Sachin-Jigar, Jigardan Gadhavi',
    album: 'Chaal Jeevi Laiye',
    searchQuery: 'Chand Ne Kaho Jigardan Gadhavi Chaal Jeevi Laiye',
    language: 'Gujarati',
    duration: 30,
    bpm: 96,
    energy: 64,
    moods: ['romantic', 'happy', 'calm'],
    intents: ['match', 'uplift', 'relax'],
    artColors: ['#fb7185', '#818cf8', '#31102f'],
    audioFallback: PUBLIC_FALLBACK_AUDIO.chill,
    baseReason: 'A joyful ode to love and living in the present, backed by gentle folk percussion.'
  },
  {
    id: 'gu-4',
    title: 'Nayan Ne Bandh Rakhine',
    artist: 'Darshan Raval',
    album: 'Gujarati Acoustic Sessions',
    searchQuery: 'Nayan Ne Bandh Rakhine Darshan Raval',
    language: 'Gujarati',
    duration: 30,
    bpm: 78,
    energy: 45,
    moods: ['sad', 'stressed', 'calm', 'romantic'],
    intents: ['relax', 'meaningful', 'uplift'],
    artColors: ['#2dd4bf', '#3b82f6', '#0f172a'],
    audioFallback: PUBLIC_FALLBACK_AUDIO.ambient,
    baseReason: 'Soothing vocal inflections and tender piano chords that act as a comforting emotional sanctuary.'
  },
  {
    id: 'en-1',
    title: 'Levitating',
    artist: 'Dua Lipa',
    album: 'Future Nostalgia',
    searchQuery: 'Levitating Dua Lipa Future Nostalgia',
    language: 'English',
    duration: 30,
    bpm: 124,
    energy: 90,
    moods: ['happy', 'motivated'],
    intents: ['energetic', 'uplift', 'match'],
    artColors: ['#ec4899', '#8b5cf6', '#3b0764'],
    audioFallback: PUBLIC_FALLBACK_AUDIO.upbeat,
    baseReason: 'Crisp funk-disco basslines and cosmic hooks engineered to spark instant dance momentum.'
  },
  {
    id: 'en-2',
    title: 'As It Was',
    artist: 'Harry Styles',
    album: "Harry's House",
    searchQuery: 'As It Was Harry Styles',
    language: 'English',
    duration: 30,
    bpm: 174,
    energy: 73,
    moods: ['happy', 'calm', 'sad'],
    intents: ['uplift', 'match', 'meaningful'],
    artColors: ['#f43f5e', '#38bdf8', '#0f172a'],
    audioFallback: PUBLIC_FALLBACK_AUDIO.upbeat,
    baseReason: 'Bright 80s indie-synth tempo contrasting with nostalgic, introspective lyricism.'
  },
  {
    id: 'en-3',
    title: 'Fix You',
    artist: 'Coldplay',
    album: 'X&Y',
    searchQuery: 'Fix You Coldplay X&Y',
    language: 'English',
    duration: 30,
    bpm: 78,
    energy: 50,
    moods: ['sad', 'stressed'],
    intents: ['uplift', 'meaningful', 'match'],
    artColors: ['#6366f1', '#ec4899', '#1e1b4b'],
    audioFallback: PUBLIC_FALLBACK_AUDIO.ambient,
    baseReason: 'Begins with gentle church organ warmth before culminating in a celebrated, cathartic electric crescendo.'
  },
  {
    id: 'en-4',
    title: 'Starboy',
    artist: 'The Weeknd, Daft Punk',
    album: 'Starboy',
    searchQuery: 'Starboy The Weeknd Daft Punk',
    language: 'English',
    duration: 30,
    bpm: 186,
    energy: 84,
    moods: ['motivated', 'happy'],
    intents: ['energetic', 'match', 'uplift'],
    artColors: ['#06b6d4', '#f43f5e', '#0f172a'],
    audioFallback: PUBLIC_FALLBACK_AUDIO.fast,
    baseReason: 'Pounding electro-pop kickdrums and Daft Punk synth arpeggios that command peak focus.'
  },
  {
    id: 'en-5',
    title: 'Holocene',
    artist: 'Bon Iver',
    album: 'Bon Iver',
    searchQuery: 'Holocene Bon Iver',
    language: 'English',
    duration: 30,
    bpm: 74,
    energy: 38,
    moods: ['calm', 'sad', 'stressed'],
    intents: ['relax', 'meaningful', 'match'],
    artColors: ['#10b981', '#0284c7', '#064e3b'],
    audioFallback: PUBLIC_FALLBACK_AUDIO.chill,
    baseReason: 'Intricate fingerpicked acoustic layers and distant horns offering grounding emotional perspective.'
  },
  {
    id: 'pa-1',
    title: 'Lover',
    artist: 'Diljit Dosanjh',
    album: 'MoonChild Era',
    searchQuery: 'Lover Diljit Dosanjh MoonChild Era',
    language: 'Punjabi',
    duration: 30,
    bpm: 110,
    energy: 82,
    moods: ['romantic', 'happy', 'motivated'],
    intents: ['match', 'energetic', 'uplift'],
    artColors: ['#f43f5e', '#a855f7', '#3b0764'],
    audioFallback: PUBLIC_FALLBACK_AUDIO.upbeat,
    baseReason: 'Sleek synth-wave production with charismatic Punjabi melodies blending romantic charm and bounce.'
  },
  {
    id: 'pa-2',
    title: 'With You',
    artist: 'AP Dhillon',
    album: 'With You - Single',
    searchQuery: 'With You AP Dhillon',
    language: 'Punjabi',
    duration: 30,
    bpm: 96,
    energy: 68,
    moods: ['romantic', 'calm', 'stressed'],
    intents: ['relax', 'match', 'uplift'],
    artColors: ['#14b8a6', '#f43f5e', '#111827'],
    audioFallback: PUBLIC_FALLBACK_AUDIO.chill,
    baseReason: 'Mellow R&B guitars with infectious vocal rhythm that make any environment instantly cozy.'
  },
  {
    id: 'pa-3',
    title: 'Born to Shine',
    artist: 'Diljit Dosanjh',
    album: 'G.O.A.T.',
    searchQuery: 'Born to Shine Diljit Dosanjh GOAT',
    language: 'Punjabi',
    duration: 30,
    bpm: 125,
    energy: 92,
    moods: ['motivated', 'happy'],
    intents: ['energetic', 'uplift', 'match'],
    artColors: ['#f59e0b', '#06b6d4', '#451a03'],
    audioFallback: PUBLIC_FALLBACK_AUDIO.fast,
    baseReason: 'Bold 808 bass and brass swagger turning sluggish mindsets into confident personal power.'
  },
  {
    id: 'in-1',
    title: 'River Flows in You',
    artist: 'Yiruma',
    album: 'First Love',
    searchQuery: 'River Flows in You Yiruma',
    language: 'Instrumental',
    duration: 30,
    bpm: 74,
    energy: 32,
    moods: ['calm', 'stressed', 'romantic'],
    intents: ['relax', 'match', 'uplift'],
    artColors: ['#10b981', '#6366f1', '#042f2e'],
    audioFallback: PUBLIC_FALLBACK_AUDIO.chill,
    baseReason: 'Gentle, cascading acoustic piano motif that resets breathing rates and invites quiet mindfulness.'
  },
  {
    id: 'in-2',
    title: 'Awake',
    artist: 'Tycho',
    album: 'Awake',
    searchQuery: 'Awake Tycho',
    language: 'Instrumental',
    duration: 30,
    bpm: 112,
    energy: 72,
    moods: ['motivated', 'calm', 'happy'],
    intents: ['match', 'energetic', 'uplift'],
    artColors: ['#06b6d4', '#f59e0b', '#0f172a'],
    audioFallback: PUBLIC_FALLBACK_AUDIO.upbeat,
    baseReason: 'Warm analog synthesizer pulses and crisp live percussion creating uninterrupted deep-focus momentum.'
  }
];

const MoodTuneLogo = ({ className = "w-9 h-9" }) => (
  <img
    src="/moodtune.svg"
    alt=""
    aria-hidden="true"
    className={`flex-shrink-0 shadow-lg shadow-fuchsia-500/20 rounded-[30%] group-hover:scale-105 transition-transform duration-300 ${className}`}
  />
);

const QuizOption = ({ selected, scene, title, description, badge, onClick }) => (
  <button type="button" onClick={onClick} aria-pressed={selected} className={`quiz-option ${selected ? 'quiz-option-selected' : ''}`}>
    <span aria-hidden="true" className="quiz-option-aurora" data-mood={scene} />
    <span aria-hidden="true" className="quiz-option-shade" />
    <span className="quiz-option-content">
      <span className="flex items-start justify-between gap-3">
        <span className="text-sm sm:text-base font-bold leading-snug">{title}</span>
        {selected ? <Check className="w-5 h-5 shrink-0 text-violet-200" /> : <ChevronRight className="w-4 h-4 shrink-0 text-white/70" />}
      </span>
      <span className="block text-xs text-slate-200 leading-relaxed mt-2">{description}</span>
      {badge && <span className="inline-block text-[10px] font-semibold rounded-full bg-black/30 border border-white/20 px-2 py-1 mt-3">{badge}</span>}
    </span>
  </button>
);

const SongCoverArt = ({ song, size = 'md', isPlaying = false, realCoverUrl = null }) => {
  const [failedUrl, setFailedUrl] = useState(null);
  const [c1, c2, c3] = song.artColors || ['#4f46e5', '#db2777', '#0f172a'];

  const sizeClass = {
    xs: 'w-11 h-11 rounded-xl',
    sm: 'w-14 h-14 rounded-xl',
    md: 'w-24 h-24 sm:w-28 sm:h-28 rounded-2xl',
    card: 'w-full aspect-square rounded-2xl',
    lg: 'w-60 h-60 sm:w-72 sm:h-72 rounded-3xl'
  }[size] || 'w-14 h-14 rounded-xl';

  const coverUrl = realCoverUrl || song.realCoverUrl;
  const validUrl = coverUrl !== failedUrl && coverUrl;

  return (
    <div
      className={`relative overflow-hidden flex-shrink-0 select-none shadow-xl border border-white/10 ${sizeClass}`}
      style={{ background: `linear-gradient(135deg, ${c1} 0%, ${c2} 55%, ${c3} 100%)` }}
    >
      {validUrl ? (
        <img
          src={validUrl}
          alt={song.title}
          onError={() => setFailedUrl(validUrl)}
          className={`w-full h-full object-cover transition-transform duration-700 ease-out ${
            isPlaying ? 'scale-105' : 'scale-100'
          }`}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center relative">
          <svg viewBox="0 0 100 100" className="w-full h-full opacity-40 mix-blend-overlay">
            <circle cx="50" cy="50" r="32" stroke="white" strokeWidth="2" fill="none" />
            <circle cx="50" cy="50" r="16" fill="white" opacity="0.4" />
            <line x1="10" y1="50" x2="90" y2="50" stroke="white" strokeWidth="1.5" />
            <line x1="50" y1="10" x2="50" y2="90" stroke="white" strokeWidth="1.5" />
          </svg>
          <Music className="w-6 h-6 text-white/70 absolute" />
        </div>
      )}

      {isPlaying && (size === 'card' || size === 'lg' || size === 'md') && (
        <div className="absolute bottom-2.5 right-2.5 flex items-end gap-1 px-2 py-1 rounded-full bg-black/70 backdrop-blur-md border border-white/15">
          <span className="w-0.5 h-3 bg-rose-400 animate-pulse rounded-full" />
          <span className="w-0.5 h-4 bg-amber-400 animate-bounce rounded-full" />
          <span className="w-0.5 h-2 bg-emerald-400 animate-pulse rounded-full" />
        </div>
      )}
    </div>
  );
};

function useMediaQuery(query) {
  return useSyncExternalStore(
    (onChange) => {
      const media = window.matchMedia(query);
      media.addEventListener('change', onChange);
      return () => media.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

export default function App() {
  const isMobile = useMediaQuery('(max-width: 639px)');
  const [screen, setScreen] = useState('welcome');
  const [quizStep, setQuizStep] = useState(0);

  const [currentMood, setCurrentMood] = useState('calm');
  const [currentIntent, setCurrentIntent] = useState('match');
  const [currentLanguage, setCurrentLanguage] = useState('Surprise');
  const [activeLangFilter, setActiveLangFilter] = useState('All');

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [liveSearchResults, setLiveSearchResults] = useState([]);
  const [openSearchResults, setOpenSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [searchRevision, setSearchRevision] = useState(0);
  const [searchHistory, setSearchHistory] = useState(() => {
    try {
      return { terms: readSearchHistory(window.localStorage), error: '' };
    } catch (error) {
      console.error('Unable to read search history.', error);
      return { terms: [], error: 'Search history could not be read on this device. You can still search or try clearing history.' };
    }
  });
  const [discovery, setDiscovery] = useState({ key: '', songs: [], status: 'loading', error: '' });
  const [discoveryRevision, setDiscoveryRevision] = useState(() => Math.floor(Math.random() * 10000));
  const [moodSuggestions, setMoodSuggestions] = useState({ key: '', songs: [], status: 'loading', error: '' });
  const [suggestionRevision, setSuggestionRevision] = useState(0);
  const [savedSongs, setSavedSongs] = useState([]);
  const [radioSeed, setRadioSeed] = useState(null);
  const [radio, setRadio] = useState({ key: '', songs: [], status: 'loading', error: '' });
  const [radioRevision, setRadioRevision] = useState(0);

  const [likedSongIds, setLikedSongIds] = useState([]);
  const [dislikedSongIds, setDislikedSongIds] = useState([]);
  const [skippedSongIds, setSkippedSongIds] = useState([]);
  const [toastMessage, setToastMessage] = useState(null);

  const [activeSong, setActiveSong] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPlayerVisible, setIsPlayerVisible] = useState(true);
  const [progressSec, setProgressSec] = useState(0);
  const [trackDuration, setTrackDuration] = useState(30);
  const [volumeState, setVolumeState] = useState(() => readVolume());
  const [volumeSupported] = useState(() => typeof Audio === 'undefined' || canSetVolume());
  const isMuted = volumeState.muted || volumeState.level === 0;
  const [isShuffle, setIsShuffle] = useState(false);
  const [isRepeat, setIsRepeat] = useState(false);
  const [isFullPlayerOpen, setIsFullPlayerOpen] = useState(false);
  const [isMoodModalOpen, setIsMoodModalOpen] = useState(false);

  const resolvedMedia = useMemo(() => ({}), []);

  const audioRef = useRef(null);
  const toastTimeoutRef = useRef(null);
  const searchInputRef = useRef(null);
  const searchDialogRef = useRef(null);
  const quizPanelRef = useRef(null);
  const moodSeenRef = useRef(new Map());
  const suggestionsSeenRef = useRef(new Map());
  const searchReturnFocusRef = useRef(null);
  const analyzingTimeoutRef = useRef(null);
  const applyLocationRef = useRef(null);
  const historyRef = useRef({ stack: [], index: 0 });
  const waitingForRadioRef = useRef(false);
  const playbackHistoryRef = useRef([]);
  const radioPlayedRef = useRef(new Set());
  const playbackStateRef = useRef({ activeSong, dislikedSongIds });
  useEffect(() => { playbackStateRef.current = { activeSong, dislikedSongIds }; }, [activeSong, dislikedSongIds]);
  const discoveryLanguage = activeLangFilter === 'All' ? currentLanguage : activeLangFilter;
  const preferenceKey = `${currentMood}:${currentIntent}:${discoveryLanguage}`;
  const discoveryKey = `${currentMood}:${currentIntent}:${discoveryLanguage}:${discoveryRevision}`;
  const discoveryEnabled = !['welcome', 'quiz', 'analyzing'].includes(screen);
  const discoveryStatus = discovery.key === discoveryKey ? discovery.status : 'loading';
  const discoveredSongs = useMemo(
    () => discovery.key === discoveryKey ? discovery.songs : [],
    [discovery, discoveryKey]
  );
  const suggestionKey = `${discoveryKey}:${suggestionRevision}`;
  const suggestionStatus = moodSuggestions.key === suggestionKey ? moodSuggestions.status : 'loading';
  const suggestedSongs = useMemo(() => moodSuggestions.key === suggestionKey ? moodSuggestions.songs : [], [moodSuggestions, suggestionKey]);
  useEffect(() => {
    if (screen !== 'quiz') return;
    quizPanelRef.current?.scrollIntoView({ block: 'start' });
    quizPanelRef.current?.focus({ preventScroll: true });
  }, [screen, quizStep]);

  const radioKey = `${radioSeed?.id}:${radioRevision}`;
  const radioStatus = radio.key === radioKey ? radio.status : 'loading';
  const radioSongs = useMemo(() => radio.key === radioKey ? radio.songs : [], [radio, radioKey]);
  const songCatalog = useMemo(() => {
    const songs = new Map([...MASTER_SONGS, ...savedSongs, ...discoveredSongs, ...suggestedSongs, ...radioSongs, ...liveSearchResults, ...openSearchResults, ...(activeSong ? [activeSong] : [])].map((song) => [song.id, song]));
    return [...songs.values()];
  }, [savedSongs, discoveredSongs, suggestedSongs, radioSongs, liveSearchResults, openSearchResults, activeSong]);

  const radioContextRef = useRef({ moodSongs: [], searchTerms: [], moodLabel: currentMood });
  useEffect(() => {
    radioContextRef.current = { moodSongs: [...discoveredSongs, ...suggestedSongs], searchTerms: searchHistory.terms, moodLabel: currentMood, intent: currentIntent, language: discoveryLanguage };
  }, [discoveredSongs, suggestedSongs, searchHistory.terms, currentMood, currentIntent, discoveryLanguage]);

  useEffect(() => {
    if (!radioSeed) return;
    const controller = new AbortController();
    let cancelled = false;
    const timeout = setTimeout(() => controller.abort(new Error('Song radio timed out. Please retry.')), 15000);
    async function loadRadio() {
      try {
        const context = radioContextRef.current;
        const excludeIds = [...radioPlayedRef.current, ...playbackStateRef.current.dislikedSongIds];
        let songs;
        let warning;
        if (radioSeed.source === 'saavn') {
          ({ songs, error: warning } = await fetchSaavnRadio(radioSeed, { excludeIds, mood: context.moodLabel, intent: context.intent, language: context.language, minimum: RADIO_MIN_SONGS }, controller.signal));
          if (cancelled) return;
          if (songs.length < RADIO_MIN_SONGS) {
            const fill = await fetchOpenRadio({ ...radioSeed, audiusUserId: null, genre: null }, { excludeIds, mood: context.moodLabel }, controller.signal).catch(() => ({ songs: [] }));
            if (cancelled) return;
            songs = [...songs, ...fill.songs.map((song) => ({ ...song, matchWhy: `Full track in a ${context.moodLabel} mood from open music.` }))].slice(0, 20);
          }
        } else {
          ({ songs, error: warning } = await fetchOpenRadio(radioSeed, { excludeIds, mood: context.moodLabel }, controller.signal));
          if (cancelled) return;
        }
        setRadio({ key: radioKey, songs, status: 'ready', error: warning });
        if (waitingForRadioRef.current) {
          waitingForRadioRef.current = false;
          const latest = playbackStateRef.current;
          const next = songs.find((song) => song.id !== latest.activeSong?.id && !latest.dislikedSongIds.includes(song.id));
          if (next) {
            if (latest.activeSong) playbackHistoryRef.current.push(latest.activeSong);
            radioPlayedRef.current.add(next.id);
            setActiveSong(next);
            setRadioSeed(next);
            setProgressSec(0);
            setIsPlaying(true);
          }
        }
      } catch (error) {
        if (cancelled) return;
        console.error('Song radio failed.', error);
        waitingForRadioRef.current = false;
        setRadio({ key: radioKey, songs: [], status: 'error', error: error.message });
      } finally {
        clearTimeout(timeout);
      }
    }
    loadRadio();
    return () => { cancelled = true; clearTimeout(timeout); controller.abort(); };
  }, [radioSeed, radioKey]);

  useEffect(() => {
    if (!discoveryEnabled) return;
    const controller = new AbortController();
    let cancelled = false;
    const timeout = setTimeout(() => controller.abort(new Error('Music discovery timed out. Please retry.')), 15000);
    async function discover() {
      try {
        const seenTitles = moodSeenRef.current.get(preferenceKey) || [];
        let songs;
        try {
          songs = await fetchSaavnMoodMix({ mood: currentMood, intent: currentIntent, language: discoveryLanguage }, discoveryRevision, controller.signal);
        } catch (error) {
          if (controller.signal.aborted) throw error;
          console.error('JioSaavn mood mix failed; using open music.', error);
          songs = await fetchOpenMoodMix({ mood: currentMood, intent: currentIntent }, discoveryRevision, controller.signal);
        }
        if (cancelled) return;
        setDiscovery({ key: discoveryKey, songs, seenTitles, status: 'ready', error: '' });
      } catch (error) {
        if (cancelled) return;
        console.error('Live discovery failed.', error);
        setDiscovery({ key: discoveryKey, songs: [], status: 'error', error: error.message });
      } finally {
        clearTimeout(timeout);
      }
    }
    discover();
    return () => {
      cancelled = true;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [currentMood, currentIntent, discoveryLanguage, discoveryRevision, discoveryKey, discoveryEnabled, preferenceKey]);

  useEffect(() => {
    if (!discoveryEnabled || discoveryStatus !== 'ready' || !discoveredSongs.length) return;
    const controller = new AbortController();
    let cancelled = false;
    const timeout = setTimeout(() => controller.abort(new Error('Related suggestions timed out. Please retry.')), 15000);
    async function suggest() {
      try {
        const options = {
          excludeIds: discoveredSongs.map((song) => song.id),
          mood: currentMood,
          intent: currentIntent,
          revision: discoveryRevision + suggestionRevision,
        };
        const fromSaavn = discoveredSongs.some((song) => song.source === 'saavn');
        const songs = fromSaavn
          ? await fetchSaavnSuggestions(discoveredSongs, options, controller.signal)
          : await fetchOpenSuggestions(discoveredSongs, options, controller.signal);
        if (cancelled) return;
        setMoodSuggestions({ key: suggestionKey, songs, status: 'ready', error: '' });
      } catch (error) {
        if (cancelled) return;
        console.error('Related mood suggestions failed.', error);
        setMoodSuggestions({ key: suggestionKey, songs: [], status: 'error', error: error.message });
      } finally {
        clearTimeout(timeout);
      }
    }
    suggest();
    return () => { cancelled = true; clearTimeout(timeout); controller.abort(); };
  }, [discoveryEnabled, discoveryStatus, discoveredSongs, discoveryRevision, suggestionRevision, suggestionKey, currentMood, currentIntent]);

  useEffect(() => {
    if (!isSearchOpen) return;
    const controller = new AbortController();
    let isCancelled = false;
    const timer = setTimeout(async () => {
      if (!searchQuery.trim()) {
        setLiveSearchResults([]);
        setOpenSearchResults([]);
        setIsSearching(false);
        return;
      }
      setIsSearching(true);
      setSearchError('');
      const timeout = setTimeout(() => controller.abort(new Error('Search timed out. Please retry.')), 15000);
      try {
        const preferences = { mood: currentMood, intent: currentIntent };
        const [primary, open] = await Promise.allSettled([
          searchSaavn(searchQuery.trim(), controller.signal, preferences, { limit: 20 }),
          searchOpenMusic(searchQuery.trim(), controller.signal, preferences),
        ]);
        if (isCancelled) return;
        const fullSongs = primary.status === 'fulfilled' ? primary.value : [];
        const openSongsFound = open.status === 'fulfilled' ? open.value.slice(0, fullSongs.length ? 6 : 12) : [];
        if (primary.status === 'rejected') console.error('JioSaavn search failed.', primary.reason);
        if (open.status === 'rejected') console.error('Open music search failed.', open.reason);
        if (primary.status === 'rejected' && open.status === 'rejected') throw primary.reason;
        setLiveSearchResults(fullSongs);
        setOpenSearchResults(openSongsFound);
        if (primary.status === 'rejected') setSearchError(primary.reason.message);
      } catch (e) {
        if (isCancelled) return;
        setSearchError(e.message);
        setLiveSearchResults([]);
        setOpenSearchResults([]);
      } finally {
        clearTimeout(timeout);
        if (!isCancelled) setIsSearching(false);
      }
    }, 600);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [searchQuery, currentMood, currentIntent, isSearchOpen, searchRevision]);

  useEffect(() => {
    if (!isSearchOpen) return;
    const previousFocus = searchReturnFocusRef.current || document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const root = document.documentElement;
    const viewport = window.visualViewport;
    // Keep the sheet inside the area left visible by the mobile keyboard.
    function syncViewport() {
      root.style.setProperty('--search-viewport-height', `${viewport ? viewport.height : window.innerHeight}px`);
      root.style.setProperty('--search-viewport-top', `${viewport ? viewport.offsetTop : 0}px`);
    }
    syncViewport();
    viewport?.addEventListener('resize', syncViewport);
    viewport?.addEventListener('scroll', syncViewport);
    window.addEventListener('resize', syncViewport);
    searchInputRef.current?.focus();
    function onKeyDown(event) {
      if (event.key !== 'Tab') return;
      const elements = [...searchDialogRef.current.querySelectorAll('button, input')].filter((el) => !el.disabled);
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = overflow;
      viewport?.removeEventListener('resize', syncViewport);
      viewport?.removeEventListener('scroll', syncViewport);
      window.removeEventListener('resize', syncViewport);
      root.style.removeProperty('--search-viewport-height');
      root.style.removeProperty('--search-viewport-top');
      document.removeEventListener('keydown', onKeyDown);
      previousFocus?.focus();
    };
  }, [isSearchOpen]);

  const triggerToast = useCallback((msg) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMessage(msg);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 2800);
  }, []);

  const handlePlaybackError = useCallback((error) => {
    if (error.name === 'AbortError') return;
    console.error('Audio playback failed.', error);
    setIsPlaying(false);
    triggerToast('Unable to play this track. Please try another song.');
  }, [triggerToast]);

  const moodProfile = useMemo(
    () => MOOD_PROFILES.find((m) => m.id === currentMood) || MOOD_PROFILES[1],
    [currentMood]
  );
  const volumeAccent = MOOD_ACCENTS[moodProfile.id] || MOOD_ACCENTS.calm;
  const intentProfile = useMemo(
    () => INTENT_PROFILES.find((i) => i.id === currentIntent) || INTENT_PROFILES[2],
    [currentIntent]
  );
  const langProfile = useMemo(
    () => LANGUAGE_PROFILES.find((l) => l.id === discoveryLanguage) || LANGUAGE_PROFILES[5],
    [discoveryLanguage]
  );

  const playlistTitle = useMemo(() => {
    const titleMap = {
      'happy-energetic': 'Radiant Rush & High Euphoria',
      'happy-match': 'Golden Hour Dopamine',
      'happy-relax': 'Sunlit Afternoon Breeze',
      'calm-relax': 'Weightless Horizon Sanctuary',
      'calm-match': 'Velvet Stillness & Gentle Air',
      'sad-meaningful': 'Midnight Rain & Lyrical Catharsis',
      'sad-uplift': 'Silver Linings & Acoustic Solace',
      'stressed-relax': 'Deep Exhale: Mind Reset',
      'romantic-match': 'Starlight Velvet & Warm Chords',
      'motivated-energetic': 'Hyperfocus & Relentless Drive',
      'motivated-match': 'Deep Flow State Architecture'
    };
    return (
      titleMap[`${currentMood}-${currentIntent}`] ||
      `${moodProfile.shortLabel.split('&')[0].trim()} • ${intentProfile.shortLabel}`
    );
  }, [currentMood, currentIntent, moodProfile, intentProfile]);

  const friendlyExplanation = useMemo(() => {
    return `A little ${moodProfile.vibeTag.toLowerCase()} inspiration, with ${intentProfile.shortLabel.toLowerCase()} discovery${discoveryLanguage === 'Surprise' ? ' from across the music catalog' : ` using your ${langProfile.badge} preference`}. Find a song that feels like you.`;
  }, [moodProfile, intentProfile, discoveryLanguage, langProfile]);

  const recommendations = useMemo(() => {
    const scored = discoveredSongs.filter((song) => !dislikedSongIds.includes(song.id)).map((song, index) => ({
      ...song,
      score: 100 - index + (likedSongIds.includes(song.id) ? 30 : 0) - (skippedSongIds.includes(song.id) ? 50 : 0),
      matchWhy: `${moodProfile.shortLabel} / ${intentProfile.shortLabel}. ${song.baseReason}`,
    }));

    scored.sort((a, b) => b.score - a.score);

    const madeForMood = prioritizeFreshSongs(scored, discovery.seenTitles, 6);
    const spotlight = madeForMood[0];
    const youMightLike = suggestedSongs.filter((song) => !dislikedSongIds.includes(song.id));

    let becauseLiked = [];
    let lastLiked = null;
    if (likedSongIds.length > 0) {
      lastLiked = savedSongs.find((s) => s.id === likedSongIds[likedSongIds.length - 1]);
      if (lastLiked) {
        becauseLiked = scored
          .filter(
            (s) =>
              s.id !== lastLiked.id &&
              (s.language === lastLiked.language || (s.moods && lastLiked.moods && s.moods.some((m) => lastLiked.moods.includes(m))))
          )
          .slice(0, 3);
      }
    }

    return { spotlight, madeForMood, youMightLike, becauseLiked, lastLiked, allScored: scored };
  }, [discoveredSongs, suggestedSongs, dislikedSongIds, likedSongIds, skippedSongIds, moodProfile, intentProfile, savedSongs, discovery.seenTitles]);

  useEffect(() => {
    if (discoveryStatus !== 'ready' || !discoveryEnabled) return;
    const previous = moodSeenRef.current.get(preferenceKey) || [];
    moodSeenRef.current.set(preferenceKey, [...previous, ...recommendations.madeForMood.map((song) => song.title)].slice(-120));
  }, [discoveryStatus, discoveryEnabled, preferenceKey, recommendations.madeForMood]);

  useEffect(() => {
    if (suggestionStatus !== 'ready' || !discoveryEnabled) return;
    const previous = suggestionsSeenRef.current.get(preferenceKey) || [];
    suggestionsSeenRef.current.set(preferenceKey, [...previous, ...suggestedSongs.map((song) => song.title)].slice(-120));
  }, [suggestionStatus, discoveryEnabled, preferenceKey, suggestedSongs]);

  const currentSong = useMemo(() => {
    const base = activeSong || recommendations.spotlight;
    if (!base) return null;
    const live = resolvedMedia[base.id];
    return {
      ...base,
      resolvedAudioUrl: base.resolvedAudioUrl || live?.previewUrl || base.audioFallback || PUBLIC_FALLBACK_AUDIO.chill,
      realCoverUrl: base.realCoverUrl || live?.artworkUrl || null
    };
  }, [activeSong, recommendations.spotlight, resolvedMedia]);

  const playbackTracks = useMemo(() => radioSeed
    ? [radioSeed, ...radioSongs].filter((song) => !dislikedSongIds.includes(song.id))
    : recommendations.allScored,
  [radioSeed, radioSongs, dislikedSongIds, recommendations.allScored]);

  const queueList = useMemo(() => {
    if (!currentSong) return recommendations.madeForMood;
    const others = upcomingTracks(playbackTracks, currentSong.id).slice(0, 20);
    return [currentSong, ...others];
  }, [currentSong, recommendations, playbackTracks]);

  const songUrl = currentSong?.resolvedAudioUrl;
  const currentSongId = currentSong?.id;

  useEffect(() => {
    const el = audioRef.current;
    if (!el || !songUrl || (!activeSong && !isPlaying)) return;

    if (el.getAttribute('data-stream-url') !== songUrl) {
      el.setAttribute('data-stream-url', songUrl);
      el.src = songUrl;
      el.load();
    }
    if (isPlaying) {
      const playPromise = el.play();
      if (playPromise !== undefined) {
        playPromise.catch(handlePlaybackError);
      }
    } else {
      el.pause();
    }
  }, [songUrl, currentSongId, activeSong, isPlaying, handlePlaybackError]);

  const seekMedia = useCallback((seconds) => {
    if (audioRef.current) audioRef.current.currentTime = seconds;
  }, []);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.muted = isMuted;
    if (volumeSupported) el.volume = toGain(volumeState.level);
  }, [isMuted, volumeState.level, volumeSupported]);

  useEffect(() => {
    saveVolume(volumeState);
  }, [volumeState]);

  const handleVolumeChange = useCallback((value) => {
    setVolumeState((prev) => setLevel(prev, value));
  }, []);

  const handleToggleMute = useCallback(() => {
    setVolumeState(toggleMute);
  }, []);

  useEffect(() => {
    function onKeyDown(event) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target;
      if (target?.closest?.('input:not([type="range"]), textarea, select, [contenteditable="true"]')) return;
      const key = event.key.toLowerCase();
      if (key === 'm') {
        event.preventDefault();
        handleToggleMute();
      } else if (volumeSupported && (event.key === ']' || event.key === '[')) {
        event.preventDefault();
        const delta = event.key === ']' ? VOLUME_STEP : -VOLUME_STEP;
        setVolumeState((prev) => setLevel(prev, (prev.muted ? 0 : prev.level) + delta));
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleToggleMute, volumeSupported]);

  const rememberSearch = useCallback(() => {
    if (!searchQuery.trim()) return;
    const terms = addSearchTerm(searchHistory.terms, searchQuery);
    try {
      window.localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(terms));
      setSearchHistory({ terms, error: '' });
    } catch (error) {
      console.error('Unable to save search history.', error);
      setSearchHistory({ terms, error: 'Search history is available for this visit, but could not be saved on this device.' });
    }
  }, [searchHistory.terms, searchQuery]);

  const handleSelectSong = (song, playImmediately = true, { keepSearchOpen = false, openPlayer = false, preserveRadio = false, toggle = true, goingBack = false } = {}) => {
    waitingForRadioRef.current = false;
    if (!keepSearchOpen) setScreen('home');
    if (activeSong?.id !== song.id) {
      if (!preserveRadio) radioPlayedRef.current = new Set();
      radioPlayedRef.current.add(song.id);
      if (activeSong && !goingBack) playbackHistoryRef.current.push(activeSong);
    }
    if (radioSeed?.id !== song.id) setRadioSeed(song);
    if (openPlayer) setIsFullPlayerOpen(true);
    if (!keepSearchOpen) setIsSearchOpen(false);
    setSavedSongs((prev) => prev.some((entry) => entry.id === song.id) ? prev : [...prev, song]);
    if (isSearchOpen && searchQuery.trim()) {
      rememberSearch();
    }
    setIsPlayerVisible(true);
    if (activeSong?.id === song.id) {
      if (playImmediately) setIsPlaying((prev) => toggle ? !prev : true);
      return;
    }
    setActiveSong(song);
    setProgressSec(0);
    setTrackDuration(song.duration || 30);
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
    }
    if (playImmediately) {
      setIsPlaying(true);
    }
    if (isSearchOpen && !keepSearchOpen) {
      setIsSearchOpen(false);
    }
  };

  const handleTogglePlay = () => {
    waitingForRadioRef.current = false;
    if (!activeSong && !recommendations.spotlight) return;
    setIsPlayerVisible(true);
    if (!activeSong && recommendations.spotlight) {
      setActiveSong(recommendations.spotlight);
      setRadioSeed(recommendations.spotlight);
      radioPlayedRef.current = new Set([recommendations.spotlight.id]);
    }
    setIsPlaying((prev) => !prev);
  };

  const handleNextSong = (isUserSkip = true) => {
    if (!currentSong) return;
    if (radioSeed && radioStatus !== 'ready') {
      setIsPlaying(false);
      waitingForRadioRef.current = radioStatus === 'loading';
      triggerToast(radioStatus === 'loading'
        ? 'Finding similar songs. Autoplay will continue when ready.'
        : 'Song radio is unavailable. Open the player to retry.');
      return;
    }
    if (isUserSkip && progressSec < 15) {
      setSkippedSongIds((prev) => (prev.includes(currentSong.id) ? prev : [...prev, currentSong.id]));
      triggerToast(`Skipped "${currentSong.title}" • Adapting recommendations`);
    }

    const list = playbackTracks;
    const candidates = upcomingTracks(list, currentSong.id);
    if (candidates.length === 0) {
      setIsPlaying(false);
      if (radioSeed && radioStatus === 'loading') {
        waitingForRadioRef.current = true;
        triggerToast('Finding similar songs. Autoplay will continue when ready.');
      } else {
        triggerToast('No next song available. Open the player to retry song radio or choose another song.');
      }
      return;
    }

    if (isShuffle) {
      const randomSong = candidates[Math.floor(Math.random() * candidates.length)];
      handleSelectSong(randomSong, true, { preserveRadio: true, toggle: false, keepSearchOpen: isSearchOpen });
      return;
    }

    handleSelectSong(candidates[0], true, { preserveRadio: true, toggle: false, keepSearchOpen: isSearchOpen });
  };

  const handlePrevSong = () => {
    if (progressSec > 4) {
      setProgressSec(0);
      seekMedia(0);
      return;
    }
    const previous = playbackHistoryRef.current.pop();
    if (!previous) {
      seekMedia(0);
      setProgressSec(0);
      return;
    }
    handleSelectSong(previous, true, { preserveRadio: true, toggle: false, keepSearchOpen: isSearchOpen, goingBack: true });
  };

  const handleToggleLike = (songId, e) => {
    if (e) e.stopPropagation();
    const song = songCatalog.find((s) => s.id === songId);
    if (!song) return;

    if (likedSongIds.includes(songId)) {
      setLikedSongIds((prev) => prev.filter((id) => id !== songId));
      triggerToast(`Removed "${song.title}" from Favorites`);
    } else {
      setSavedSongs((prev) => prev.some((entry) => entry.id === songId) ? prev : [...prev, song]);
      setLikedSongIds((prev) => [...prev, songId]);
      setDislikedSongIds((prev) => prev.filter((id) => id !== songId));
      triggerToast(`Liked "${song.title}" • Added similar vibes`);
    }
  };

  const handleDislikeSong = (songId, e) => {
    if (e) e.stopPropagation();
    const song = songCatalog.find((s) => s.id === songId);
    if (!song) return;

    setDislikedSongIds((prev) => (prev.includes(songId) ? prev : [...prev, songId]));
    setLikedSongIds((prev) => prev.filter((id) => id !== songId));
    triggerToast(`Tuning out "${song.title}" and adjusting your vibe`);
    if (currentSong?.id === songId) {
      handleNextSong(false);
    }
  };

  const handleSeek = (e) => {
    const trackRect = e.currentTarget.getBoundingClientRect();
    const clickRatio = Math.max(0, Math.min(1, (e.clientX - trackRect.left) / trackRect.width));
    const newSeconds = Math.floor(clickRatio * trackDuration);
    setProgressSec(newSeconds);
    if (audioRef.current && Number.isFinite(audioRef.current.duration)) {
      seekMedia(newSeconds);
    }
  };

  const handleStopAndClosePlayer = (e) => {
    waitingForRadioRef.current = false;
    if (e) e.stopPropagation();
    setIsPlaying(false);
    setIsFullPlayerOpen(false);
    setIsPlayerVisible(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setProgressSec(0);
  };

  const handleQuickMoodSwitch = (moodId) => {
    setCurrentMood(moodId);
    const profile = MOOD_PROFILES.find((m) => m.id === moodId);
    triggerToast(`Shifted vibe to ${profile?.shortLabel || moodId}`);
    setIsMoodModalOpen(false);
  };

  const handleSkipDirectlyToSongs = () => {
    setScreen('home');
    triggerToast('Your live discovery mix is ready to explore');
  };

  const updateSearch = (query) => {
    setSearchQuery(query);
    setLiveSearchResults([]);
    setSearchError('');
    setIsSearching(Boolean(query.trim()));
  };

  const closeSearch = () => {
    rememberSearch();
    setIsSearchOpen(false);
  };

  const clearSearchHistory = () => {
    try {
      window.localStorage.removeItem(SEARCH_HISTORY_KEY);
      setSearchHistory({ terms: [], error: '' });
      triggerToast('Search history cleared from this device.');
    } catch (error) {
      console.error('Unable to clear search history.', error);
      setSearchHistory((previous) => ({ ...previous, error: 'Search history could not be cleared. Check your browser storage settings and try again.' }));
    }
  };

  const openSearch = () => {
    searchReturnFocusRef.current = document.activeElement;
    updateSearch('');
    setIsSearchOpen(true);
  };

  const finishQuizWithLang = (langChoice) => {
    setCurrentLanguage(langChoice);
    setActiveLangFilter('All');
    setScreen('analyzing');
    clearTimeout(analyzingTimeoutRef.current);
    analyzingTimeoutRef.current = setTimeout(() => {
      setScreen('home');
    }, 700);
  };

  useEffect(() => {
    applyLocationRef.current = (location) => {
      clearTimeout(analyzingTimeoutRef.current);
      if (isSearchOpen && !location.search) rememberSearch();
      if (location.search && !isSearchOpen) {
        searchReturnFocusRef.current = document.activeElement;
        updateSearch('');
      }
      setScreen(location.screen);
      if (location.screen === 'quiz') setQuizStep(location.step);
      setIsSearchOpen(location.search);
      setIsFullPlayerOpen(location.player);
      setIsMoodModalOpen(location.mood);
    };
  });

  useEffect(() => {
    function onPopState(event) {
      const entry = event.state?.moodtune;
      if (!entry) return;
      historyRef.current.index = entry.index;
      historyRef.current.stack[entry.index] = entry.location;
      applyLocationRef.current?.(entry.location);
    }
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    const location = { screen, step: quizStep, search: isSearchOpen, player: isFullPlayerOpen, mood: isMoodModalOpen };
    const history = historyRef.current;
    if (!history.stack.length) {
      if (screen === 'analyzing') return;
      history.stack = [location];
      history.index = 0;
      window.history.replaceState({ ...window.history.state, moodtune: { index: 0, location } }, '');
      return;
    }
    const action = planHistoryUpdate(history.stack, history.index, location);
    if (action === 'back') {
      history.index -= 1;
      window.history.back();
    } else if (action === 'replace') {
      history.stack[history.index] = location;
      window.history.replaceState({ moodtune: { index: history.index, location } }, '');
    } else if (action === 'push') {
      history.index += 1;
      history.stack = [...history.stack.slice(0, history.index), location];
      window.history.pushState({ moodtune: { index: history.index, location } }, '');
    }
  }, [screen, quizStep, isSearchOpen, isFullPlayerOpen, isMoodModalOpen]);

  const formatDuration = (secs) => {
    if (isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const greetingTime = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const filteredMadeForMood = useMemo(() => {
    return recommendations.madeForMood
      .filter((s) => activeLangFilter === 'All' || s.language.toLowerCase() === activeLangFilter.toLowerCase());
  }, [recommendations, activeLangFilter]);

  const quickMoodShift = (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          <Compass className="w-3.5 h-3.5 text-cyan-400" />
          Quick Mood Shift
        </span>
        <span className="hidden sm:inline text-[11px] text-slate-500">Tap to instantly morph your mix</span>
        <span className="sm:hidden text-[11px] text-slate-500">Not feeling it? Swipe a new mood</span>
      </div>
      <div className="m-rail m-rail-moods grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {MOOD_PROFILES.map((m) => {
          const isActive = currentMood === m.id;
          return (
            <TiltedCard key={m.id} rotateAmplitude={6} scaleOnHover={1.03} glare={0.2} className="h-full">
              <button
                aria-pressed={isActive}
                onClick={() => handleQuickMoodSwitch(m.id)}
                className={`p-3 rounded-2xl border text-left transition-all flex items-center gap-3 w-full h-full ${
                  isActive
                    ? `bg-gradient-to-r ${m.cardGradient} text-white border-white/40 shadow-lg scale-[1.02]`
                    : 'bg-white/[0.04] hover:bg-white/[0.08] border-white/10 text-slate-300'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    isActive ? 'bg-black/25 text-white' : 'bg-white/10 text-white'
                  }`}
                >
                  <Music className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-xs truncate">{m.shortLabel.split('&')[0]}</div>
                  <div className={`text-[10px] truncate ${isActive ? 'text-white/80' : 'text-slate-400'}`}>
                    {m.vibeTag.split(' ')[0]}
                  </div>
                </div>
              </button>
            </TiltedCard>
          );
        })}
      </div>
    </div>
  );

  return (
    <ClickSpark
      sparkColor={MOOD_SPARK_COLORS[currentMood] || ['#fbbf24', '#f43f5e', '#c084fc', '#38bdf8']}
      className="min-h-screen bg-slate-950 text-white font-sans selection:bg-rose-500 selection:text-white relative overflow-x-hidden flex flex-col items-center"
    >
      <TargetCursor targetSelector="button, a, input, [role='button'], .cursor-target, .mood-tile, .taste-card, .quiz-option" />
      <audio
        ref={audioRef}
        preload="metadata"
        onError={(e) => handlePlaybackError(e.currentTarget.error)}
        onTimeUpdate={(e) => {
          const cur = Math.floor(e.currentTarget.currentTime || 0);
          setProgressSec(cur);
        }}
        onLoadedMetadata={(e) => {
          const dur = Math.floor(e.currentTarget.duration || 0);
          if (dur > 0 && Number.isFinite(dur)) {
            setTrackDuration(dur);
          }
        }}
        onEnded={() => {
          if (isRepeat && audioRef.current) {
            audioRef.current.currentTime = 0;
            audioRef.current.play().catch(handlePlaybackError);
          } else {
            handleNextSong(false);
          }
        }}
      />

      <div
        className="fixed inset-0 pointer-events-none transition-all duration-1000 z-0 overflow-hidden"
        style={{
          background: `radial-gradient(circle at 18% 12%, ${moodProfile.bgGlow}, transparent 48%), radial-gradient(circle at 84% 82%, ${moodProfile.bgGlow}, transparent 52%)`
        }}
      >
        <Aurora
          colorStops={MOOD_AURORA_COLORS[currentMood] || ['#8b5cf6', '#ec4899', '#3b82f6']}
          amplitude={1.0}
          speed={0.45}
          opacity={0.65}
        />
      </div>

      <header className="w-full max-w-6xl px-4 sm:px-6 pt-4 pb-2 flex items-center justify-between text-xs text-slate-300 z-20">
        <Magnet padding={40} magnetStrength={3} maxOffset={8}>
          <button
            aria-label="MoodTune home"
            onClick={() => setScreen('welcome')}
            className="flex items-center gap-3 text-left cursor-pointer group select-none"
          >
            <MoodTuneLogo className="w-9 h-9" />
            <div className="flex flex-col">
              <span className="text-base font-extrabold tracking-tight text-white leading-none flex items-center gap-1.5">
                <GradientText colors={['#ffffff', '#ddd6fe', '#fbcfe8', '#ffffff']} animationSpeed={6}>MoodTune</GradientText>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              </span>
              <span className="text-[11px] text-slate-400 font-medium">Your mood. Your music.</span>
            </div>
          </button>
        </Magnet>

        <div className="flex items-center gap-2 sm:gap-3">
          {screen !== 'home' && (
            <button
              onClick={handleSkipDirectlyToSongs}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-gradient-to-r from-rose-500/20 to-amber-500/20 hover:from-rose-500/30 hover:to-amber-500/30 border border-amber-400/30 text-amber-300 font-semibold transition text-xs shadow-sm"
              title="Skip questions and jump directly to songs"
            >
              <span>Skip to Songs</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={handleToggleMute}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-full border transition text-xs ${
              !isMuted
                ? 'bg-white/10 border-white/15 text-white'
                : 'bg-white/5 border-white/10 text-slate-400'
            }`}
            title={`${isMuted ? 'Unmute' : 'Mute'} (M)`}
            aria-label={isMuted ? 'Unmute' : 'Mute'}
          >
            <VolumeIcon level={volumeState.level} muted={isMuted} className={`w-3.5 h-3.5 ${isMuted ? '' : 'text-emerald-400'}`} />
            <span className="hidden md:inline">{isMuted ? 'Muted' : volumeSupported ? `Sound ${Math.round(volumeState.level * 100)}%` : 'Sound On'}</span>
          </button>

          {screen === 'home' && (
            <Magnet padding={35} magnetStrength={3} maxOffset={6}>
              <button
                onClick={() => {
                  setQuizStep(0);
                  setScreen('quiz');
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white/10 hover:bg-white/15 border border-white/15 text-white font-medium transition shadow-sm text-xs"
              >
                <RefreshCw className="w-3 h-3 text-amber-300" />
                <span className="hidden sm:inline">Retake Mood Quiz</span>
              </button>
            </Magnet>
          )}
        </div>
      </header>

      {toastMessage && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-slate-900/95 border border-white/20 text-xs sm:text-sm text-white shadow-2xl backdrop-blur-xl flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {isSearchOpen && (
        <div className="search-overlay fixed inset-x-0 bg-slate-950/85 backdrop-blur-xl flex items-end sm:items-start justify-center sm:pt-12 sm:px-4" onClick={(e) => { if (e.target === e.currentTarget) closeSearch(); }}>
          <div ref={searchDialogRef} role="dialog" aria-modal="true" aria-labelledby="search-title" onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); closeSearch(); } }} className="search-studio border border-white/15 rounded-t-3xl sm:rounded-3xl max-w-2xl w-full p-4 sm:p-7 shadow-2xl flex flex-col gap-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] tracking-[0.25em] uppercase text-violet-300 font-bold mb-2">The discovery studio</p>
                <h2 id="search-title" className="text-xl sm:text-3xl font-black tracking-tight">Find your next song.</h2>
                <p className="text-xs text-slate-400 mt-2">Every result is a full song. Left button plays it here; tap a song to open its player and song radio.</p>
              </div>
              <button aria-label="Close search" onClick={closeSearch} className="search-touch-button rounded-full bg-white/5 hover:bg-white/15"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3">
              <div className="flex items-center gap-3 flex-1">
                <Search className="w-5 h-5 text-amber-400 flex-shrink-0" />
                <input
                  ref={searchInputRef}
                  type="text"
                  aria-label="Search songs or artists"
                  value={searchQuery}
                  onChange={(e) => updateSearch(e.target.value)}
                  onKeyDown={(event) => { if (event.key === 'Enter' && !event.nativeEvent.isComposing) rememberSearch(); }}
                  placeholder="What do you want to hear?"
                  className="min-w-0 w-full bg-transparent py-3 text-base text-white placeholder-slate-400 focus:outline-none"
                />
              </div>
              <button
                onClick={() => {
                  updateSearch('');
                  searchInputRef.current?.focus();
                }}
                aria-label="Clear search"
                className="search-touch-button rounded-full hover:bg-white/10 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div
              className="search-scroll-area space-y-4"
              onTouchMove={() => { if (document.activeElement === searchInputRef.current) searchInputRef.current?.blur(); }}
            >
            {searchHistory.error && <div role="alert" className="text-xs text-amber-200 rounded-xl border border-amber-300/20 p-3">
              <p>{searchHistory.error}</p><button onClick={clearSearchHistory} className="underline mt-2">Clear history</button>
            </div>}
            {!searchQuery.trim() && (
              <div className="space-y-5 py-2">
                <div className="rounded-2xl bg-gradient-to-r from-violet-500/15 to-rose-500/10 p-4 border border-violet-400/20">
                  <span className="text-xs text-violet-200">A starting point for your {moodProfile.shortLabel.toLowerCase()} mood</span>
                  <button onClick={() => updateSearch(discoveryQueries(currentMood, currentIntent, discoveryLanguage)[0])} className="mt-3 flex items-center justify-between w-full text-left font-semibold">
                    Explore {moodProfile.vibeTag} <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
                {searchHistory.terms.length > 0 && <div>
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <p className="text-[11px] uppercase tracking-widest text-slate-400">Recent searches</p>
                    <button onClick={clearSearchHistory} className="text-xs text-violet-200 min-h-11 px-2">Clear history</button>
                  </div>
                  <p className="text-[11px] text-slate-400 mb-3">Last 10 searches. Saved only in this browser on this device.</p>
                  <div className="flex flex-wrap gap-2">{searchHistory.terms.map((term) => <button key={term} onClick={() => updateSearch(term)} className="search-chip max-w-full"><Clock className="w-3 h-3 shrink-0" /><span className="truncate">{term}</span></button>)}</div>
                </div>}
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Try a favorite</span>
                <div className="flex flex-wrap gap-2">
                  {['Ilahi', 'Arijit Singh', 'Kasoor', 'Khalasi', 'Levitating', 'AP Dhillon', 'Kun Faya Kun'].map((tag) => (
                    <button
                      key={tag}
                      onClick={() => updateSearch(tag)}
                      className="search-chip"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div aria-live="polite" role="status" className="text-xs text-slate-400">
              {searchQuery.trim() && (isSearching ? 'Finding your sound...' : searchError && !liveSearchResults.length && !openSearchResults.length ? 'Online search is unavailable.' : `${liveSearchResults.length + openSearchResults.length} full songs`)}
            </div>
            {searchQuery.trim() && isSearching ? (
              <div className="space-y-3" aria-label="Loading search results">{[0, 1, 2].map((i) => <div key={i} className="h-16 rounded-2xl bg-white/5 motion-safe:animate-pulse" />)}</div>
            ) : searchQuery.trim() && searchError && !liveSearchResults.length && !openSearchResults.length ? (
              <div role="alert" className="rounded-2xl p-5 bg-rose-500/10 border border-rose-400/20 text-sm">
                <p>{searchError}</p><button className="search-chip mt-3" onClick={() => { setIsSearching(true); setSearchRevision((value) => value + 1); }}>Try again</button>
              </div>
            ) : searchQuery.trim() && (liveSearchResults.length > 0 || openSearchResults.length > 0) ? (
              <div className="space-y-2">
                {searchError && <p role="status" className="text-xs text-amber-200 px-1">{searchError}</p>}
                {[{ key: 'saavn', songs: liveSearchResults, title: 'Full songs · JioSaavn' }, { key: 'open', songs: openSearchResults, title: 'Open music · independent artists on Audius' }].filter((group) => group.songs.length).map((group) => (
                  <div key={group.key} className="space-y-2">
                    {group.title && <p className={`pt-3 px-1 text-[11px] font-bold uppercase tracking-wider ${group.key === 'saavn' ? 'text-teal-300' : 'text-fuchsia-300'}`}>{group.title}</p>}
                    {group.songs.map((song) => (
                  <div
                    key={song.id}
                    onClick={() => handleSelectSong(song, true, { openPlayer: true, toggle: false })}
                    className={`search-result flex items-center rounded-2xl border transition ${currentSong?.id === song.id ? 'bg-violet-500/20 border-violet-400/40' : 'bg-white/[0.03] border-white/5 hover:border-violet-400/30'}`}
                  >
                    <button
                      aria-label={`${currentSong?.id === song.id && isPlaying ? 'Pause' : 'Play'} ${song.title} by ${song.artist}`}
                      onClick={(event) => { event.stopPropagation(); handleSelectSong(song, true, { keepSearchOpen: true }); }}
                      className="search-preview-button"
                    >
                      {currentSong?.id === song.id && isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
                    </button>
                    <button
                      aria-label={`Open player for ${song.title} by ${song.artist}`}
                      onClick={(event) => { event.stopPropagation(); handleSelectSong(song, true, { openPlayer: true, toggle: false }); }}
                      className="flex flex-1 items-center gap-3 min-w-0 text-left py-3 pr-3 group"
                    >
                      <SongCoverArt
                        song={song}
                        realCoverUrl={song.realCoverUrl || resolvedMedia[song.id]?.artworkUrl}
                        size="xs"
                        isPlaying={currentSong?.id === song.id && isPlaying}
                      />
                      <div className="min-w-0">
                        <h4 className="text-sm font-semibold text-white truncate group-hover:text-amber-300 transition">
                          {song.title}
                        </h4>
                        <p className="text-xs text-slate-400 truncate">{song.artist}</p>
                        <span className="text-[10px] text-violet-300">{currentSong?.id === song.id && isPlaying ? 'Now playing · full song' : `Full song${song.duration ? ` · ${formatDuration(song.duration)}` : ''}`}</span>
                      </div>
                      <ChevronRight className="w-4 h-4 shrink-0 text-slate-400 ml-auto" />
                    </button>
                  </div>
                ))}
                  </div>
                ))}
              </div>
            ) : searchQuery.trim() ? (
              <div className="py-8 text-center"><Music className="w-8 h-8 text-violet-300 mx-auto mb-3" /><p className="font-semibold">A different sound is out there.</p><p className="text-xs text-slate-400 mt-2">No songs found. Try an artist name or a shorter search.</p></div>
            ) : null}
            </div>
          </div>
        </div>
      )}

      {!isMoodModalOpen && !isSearchOpen && !isFullPlayerOpen && (
        <div
          aria-hidden="true"
          className={`bottom-dock-backdrop ${(screen === 'home' || activeSong) && currentSong && isPlayerVisible ? 'bottom-dock-backdrop-tall' : ''}`}
        />
      )}

      {!isMoodModalOpen && <button
        hidden={isSearchOpen}
        className={`floating-search ${(screen === 'home' || activeSong) && currentSong && isPlayerVisible && !isFullPlayerOpen ? 'floating-search-with-player' : ''}`}
        onClick={openSearch} aria-label="Search songs or artists from anywhere">
        <span className="floating-search-icon"><Search className="w-5 h-5" /></span>
        <span className="flex-1 text-left">Search any song or artist</span>
        <span className="text-[10px] text-violet-200">Discover <ArrowRight className="w-3 h-3 inline" /></span>
      </button>}

      <div className="w-full max-w-6xl px-4 sm:px-6 pb-56 pt-2 z-10 flex-1 flex flex-col items-center">
        {screen === 'welcome' && (
          <div className="w-full py-8 sm:py-14 space-y-10">
            <div className="welcome-stage relative grid lg:grid-cols-[1.2fr_1fr] gap-8 items-center">
            <div className="relative z-10 py-4 sm:py-8">
              <div className="w-64 h-64 bg-rose-500/15 rounded-full blur-3xl pointer-events-none absolute -top-24 -left-24" />
              <div className="w-64 h-64 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none absolute -bottom-24 -right-24" />

              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/15 mb-6">
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <ShinyText
                  text="Less scrolling. More feeling."
                  color="#cbd5e1"
                  shineColor="#ffffff"
                  speed={2.6}
                  className="text-xs font-semibold tracking-wider uppercase text-white/90"
                />
              </div>

              <h1 className="text-5xl sm:text-7xl font-black tracking-[-0.055em] text-white leading-[1.02] mb-6">
                Your mood.<br />
                <GradientText colors={['#c4b5fd', '#f472b6', '#fb923c', '#38bdf8', '#c4b5fd']} animationSpeed={6}>
                  Your next<br />favorite song.
                </GradientText>
              </h1>
              <p className="text-base sm:text-lg text-slate-300 max-w-xl mx-auto mb-8 leading-relaxed">
                Turn a little feeling into a whole soundtrack. Discover fresh finds, press play, and let the rest of the world wait.
              </p>

              <div className="flex flex-col sm:flex-row items-center gap-3.5 mb-6">
                <Magnet padding={60} magnetStrength={2.5} maxOffset={10} wrapperClassName="w-full sm:w-auto">
                  <button
                    onClick={() => {
                      setQuizStep(0);
                      setScreen('quiz');
                    }}
                    className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-rose-500 via-amber-500 to-indigo-500 hover:opacity-95 text-white font-bold text-base shadow-xl shadow-rose-500/20 flex items-center justify-center gap-2.5 transition transform hover:scale-[1.02] active:scale-[0.99]"
                  >
                    <Sparkles className="w-5 h-5" />
                    <span>Find my sound</span>
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </Magnet>

                <button
                  onClick={handleSkipDirectlyToSongs}
                  className="w-full sm:w-auto px-6 py-4 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 text-white font-semibold text-sm flex items-center justify-center gap-2 transition"
                >
                  <Music className="w-4 h-4 text-emerald-400" />
                  <span>Explore the music</span>
                </button>
              </div>

              <div className="flex flex-wrap gap-5 text-[11px] text-slate-400">
                <span className="flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5 text-violet-300" /> Live music discovery</span>
                <span className="flex items-center gap-1.5"><Volume2 className="w-3.5 h-3.5 text-rose-300" /> Full songs, no previews</span>
                <span>3 questions. Your kind of music.</span>
              </div>
            </div>
            <div className="record-scene" aria-hidden="true">
              <div className="record-orbit" />
              <div className={`vinyl-record ${isPlaying ? 'is-spinning' : ''}`}>
                <div className="vinyl-label"><MoodTuneLogo className="w-16 h-16" /><span>MOODTUNE / FEEL &amp; PLAY</span></div>
              </div>
              <div className="record-caption"><span className="w-2 h-2 bg-emerald-300 rounded-full motion-safe:animate-pulse" /> A little escape, on repeat.</div>
              <div className="sound-bars">{[22, 38, 16, 48, 30, 56, 20, 44, 28, 40, 18, 32].map((height, index) => <i key={index} style={{ height, animationDelay: `${index * 0.12}s` }} />)}</div>
            </div>
            </div>
            <TasteSuggestions
              history={searchHistory.terms} currentSongId={currentSong?.id} isPlaying={isPlaying}
              onPreview={(song) => handleSelectSong(song, true, { keepSearchOpen: true })}
              onOpen={(song) => handleSelectSong(song, true, { openPlayer: true, toggle: false })}
              onClear={clearSearchHistory}
            />
              <div className="border-t border-white/10 pt-8">
                <div className="flex flex-wrap justify-between gap-2 mb-5">
                  <div><p className="text-[10px] uppercase tracking-[0.25em] text-violet-300 mb-2">Start with a feeling</p><h2 className="text-2xl font-bold tracking-tight">What&apos;s your energy today?</h2></div>
                  <p className="text-xs text-slate-400 self-end">Pick a mood. Discover something new.</p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  {MOOD_PROFILES.map((mood) => (
                    <TiltedCard key={mood.id} rotateAmplitude={8} scaleOnHover={1.03} glare={0.25} className="h-full">
                      <button
                        onClick={() => {
                          setCurrentMood(mood.id);
                          setScreen('home');
                          triggerToast(`Soundscape tuned to ${mood.shortLabel}`);
                        }}
                        className={`mood-tile w-full h-full group p-4 rounded-2xl bg-gradient-to-br ${mood.gradient} border border-white/10 hover:border-white/40 transition text-left flex flex-col gap-5`}
                      >
                        <div
                          className={`w-9 h-9 rounded-xl bg-gradient-to-br ${mood.cardGradient} flex items-center justify-center flex-shrink-0 shadow-md group-hover:scale-105 transition`}
                        >
                          <Music className="w-4 h-4 text-white" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-semibold text-white leading-relaxed min-h-[2.5em] group-hover:text-amber-200 transition">
                            {mood.shortLabel}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">Discover your mix <ArrowRight className="w-3 h-3" /></div>
                        </div>
                      </button>
                    </TiltedCard>
                  ))}
                </div>
                  <div className="mt-6 flex flex-wrap items-center justify-between gap-3 p-5 rounded-2xl bg-white/[0.03] border border-white/10">
                    <div><p className="font-semibold">Already have a song in mind?</p><p className="text-xs text-slate-400 mt-1">Follow an artist, a lyric in your head, or a favorite sound.</p></div>
                    <button onClick={openSearch} className="search-chip"><Search className="w-4 h-4" /> Open discovery studio <ArrowRight className="w-4 h-4" /></button>
              </div>
            </div>
          </div>
        )}

        {screen === 'quiz' && (
          <div className="min-h-[78vh] w-full flex flex-col justify-center items-center px-2 py-8">
            <div ref={quizPanelRef} tabIndex={-1} role="group" aria-label={`Find my sound, step ${quizStep + 1} of 3`} className="max-w-2xl w-full bg-slate-900/85 border border-white/15 rounded-3xl p-5 sm:p-10 shadow-2xl backdrop-blur-2xl">
              <div className="flex items-center justify-between gap-3 mb-6">
                <button
                  onClick={() => {
                    if (quizStep === 0) setScreen('welcome');
                    else setQuizStep((s) => s - 1);
                  }}
                  className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-white transition"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>

                <div className="flex items-center gap-2">
                  {[0, 1, 2].map((step) => (
                    <div
                      key={step}
                      className={`hidden sm:block h-1.5 rounded-full transition-all duration-300 ${
                        step === quizStep
                          ? 'w-8 bg-amber-400'
                          : step < quizStep
                          ? 'w-4 bg-emerald-400'
                          : 'w-4 bg-white/15'
                      }`}
                    />
                  ))}
                  <span className="text-xs text-slate-400 whitespace-nowrap">Step {quizStep + 1} of 3</span>
                </div>

                <button
                  onClick={handleSkipDirectlyToSongs}
                  className="shrink-0 text-xs font-semibold text-amber-300 hover:text-amber-200 transition"
                >
                  <span className="sm:hidden">Skip →</span><span className="hidden sm:inline">Skip to Songs →</span>
                </button>
              </div>

              {quizStep === 0 && (
                <div className="space-y-4">
                  <span className="text-xs font-semibold uppercase tracking-widest text-amber-400">
                    Question 1 of 3 • Emotional Check-In
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-bold text-white">How are you feeling right now?</h2>
                  <p className="text-sm text-slate-400">
                    Pick the emotional landscape that matches your present state of mind.
                  </p>

                  <div className="quiz-option-grid grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    {MOOD_PROFILES.map((m) => {
                      const isSelected = currentMood === m.id;
                      return (
                        <QuizOption
                          key={m.id}
                          selected={isSelected}
                          scene={m.id}
                          title={m.label}
                          description={m.subtitle}
                          onClick={() => {
                            setCurrentMood(m.id);
                            setQuizStep(1);
                          }}
                        />
                      );
                    })}
                  </div>
                </div>
              )}

              {quizStep === 1 && (
                <div className="space-y-4">
                  <span className="text-xs font-semibold uppercase tracking-widest text-emerald-400">
                    Question 2 of 3 • Listening Direction
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-bold text-white">What kind of music would you like right now?</h2>
                  <p className="text-sm text-slate-400">
                    Would you like to stay in this emotional rhythm or gently shift your energy?
                  </p>

                  <div className="quiz-option-grid grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    {INTENT_PROFILES.map((intent) => {
                      const isSelected = currentIntent === intent.id;
                      return (
                        <QuizOption
                          key={intent.id}
                          selected={isSelected}
                          scene={{ match: currentMood, uplift: 'happy', relax: 'calm', energetic: 'motivated', meaningful: 'sad' }[intent.id]}
                          title={intent.shortLabel}
                          description={intent.desc}
                          onClick={() => {
                            setCurrentIntent(intent.id);
                            setQuizStep(2);
                          }}
                        />
                      );
                    })}
                  </div>
                </div>
              )}

              {quizStep === 2 && (
                <div className="space-y-4">
                  <span className="text-xs font-semibold uppercase tracking-widest text-rose-400">
                    Question 3 of 3 • Language & Genre
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-bold text-white">What language or music style do you prefer?</h2>
                  <p className="text-sm text-slate-400">
                    We’ll weave your emotional state and energy goal with your chosen musical styles.
                  </p>

                  <div className="quiz-option-grid grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    {LANGUAGE_PROFILES.map((lang) => {
                      const isSelected = currentLanguage === lang.id;
                      return (
                        <QuizOption
                          key={lang.id}
                          selected={isSelected}
                          scene={{ Hindi: 'romantic', English: 'motivated', Gujarati: 'happy', Punjabi: 'motivated', Instrumental: 'calm', Surprise: 'romantic' }[lang.id]}
                          title={lang.label}
                          description={lang.sub}
                          badge={lang.badge}
                          onClick={() => finishQuizWithLang(lang.id)}
                        />
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {screen === 'analyzing' && (
          <div className="min-h-[72vh] w-full flex flex-col justify-center items-center text-center px-4">
            <div className="p-8 rounded-3xl bg-white/5 border border-white/10 max-w-md w-full backdrop-blur-2xl space-y-5">
              <div
                className={`w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br ${moodProfile.cardGradient} flex items-center justify-center shadow-lg animate-pulse`}
              >
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white">Synthesizing Your Soundscape...</h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                Harmonizing your <span className="text-amber-300 font-semibold">{moodProfile.shortLabel}</span> mood with{' '}
                <span className="text-emerald-300 font-semibold">{intentProfile.shortLabel}</span> in{' '}
                <span className="text-rose-300 font-semibold">{langProfile.label}</span>.
              </p>
              <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                <div className="bg-gradient-to-r from-rose-500 via-amber-400 to-emerald-400 h-full w-4/5 animate-pulse rounded-full" />
              </div>
            </div>
          </div>
        )}

        {screen === 'home' && (
          <div className="w-full space-y-7 pt-1">
            <div className="flex flex-wrap items-end justify-between gap-3 pt-6">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-violet-300 mb-2">Your own little corner of music</p>
                <ShinyText text="Stay for one more song." color="#ffffff" shineColor="#c4b5fd" speed={3.2} className="text-2xl sm:text-3xl font-black tracking-tight" />
              </div>
              <button onClick={() => setDiscoveryRevision((value) => value + 1)} className="search-chip" disabled={discoveryStatus === 'loading'}><RefreshCw className={`w-3.5 h-3.5 ${discoveryStatus === 'loading' ? 'animate-spin' : ''}`} /> Find a fresh mix</button>
            </div>
            <div
              className={`mood-summary relative overflow-hidden rounded-3xl bg-gradient-to-br ${moodProfile.gradient} border ${moodProfile.borderGlow} p-5 sm:p-8 shadow-2xl backdrop-blur-3xl transition-all duration-700`}
            >
              <div
                className="absolute -top-20 -right-20 w-80 h-80 rounded-full blur-3xl pointer-events-none opacity-60 transition-all duration-1000"
                style={{ background: moodProfile.bgGlow }}
              />

              <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="space-y-3.5 max-w-2xl">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="hidden sm:inline text-[11px] font-bold tracking-widest uppercase text-white/70 bg-white/10 px-3 py-1 rounded-full border border-white/10">
                      {String(greetingTime)}
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/40 border border-white/15 text-xs font-semibold text-white">
                      <Music className="w-3.5 h-3.5 text-amber-300" />
                      <span>{String(moodProfile.shortLabel)}</span>
                    </span>
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white/10 border border-white/10 text-xs text-white/90">
                      <span>{String(intentProfile.shortLabel)}</span>
                    </span>
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white/10 border border-white/10 text-xs text-white/90">
                      <span>{String(langProfile.badge)}</span>
                    </span>
                  </div>

                  <div>
                    <h1 className="text-xl sm:text-4xl font-black text-white tracking-tight leading-tight">
                      {String(playlistTitle)}
                    </h1>
                    <p className="hidden sm:block text-sm text-slate-200/90 leading-relaxed mt-1.5 max-w-xl">
                      &ldquo;{String(friendlyExplanation)}&rdquo;
                    </p>
                    <p className="sm:hidden text-xs text-slate-200/90 mt-2 leading-relaxed">Full songs for your mood. Press play and explore.</p>
                  </div>

                  <div className="mood-summary-actions flex items-center gap-2 sm:gap-3 pt-1">
                    <Magnet padding={45} magnetStrength={3} maxOffset={8} wrapperClassName="inline-block">
                      <button
                        onClick={() => {
                          if (isPlaying) {
                            setIsPlaying(false);
                          } else if (recommendations.spotlight) {
                            handleSelectSong(recommendations.spotlight, true);
                          }
                        }}
                        disabled={!recommendations.spotlight}
                        className="min-h-11 px-4 sm:px-6 py-3 rounded-2xl bg-white text-slate-950 font-extrabold text-xs sm:text-sm shadow-xl flex items-center justify-center gap-2 hover:bg-amber-100 hover:scale-[1.02] active:scale-[0.98] transition"
                      >
                        {isPlaying ? (
                          <>
                            <Pause className="w-4 h-4 fill-current" />
                            <span>Pause Flow</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-4 h-4 fill-current" />
                            <span>Play Mood Radio</span>
                          </>
                        )}
                      </button>
                    </Magnet>

                    <button
                      onClick={() => setIsMoodModalOpen(true)}
                      className="min-h-11 px-3 sm:px-4 py-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 font-medium text-xs sm:text-sm flex items-center justify-center gap-2 transition"
                    >
                      <Sliders className="w-4 h-4" />
                      <span>Change Mood</span>
                    </button>
                  </div>
                </div>

                {recommendations.spotlight && (
                  <TiltedCard rotateAmplitude={12} scaleOnHover={1.03} glare={0.4} className="self-center lg:self-auto">
                    <button
                      type="button"
                      aria-label={`Play spotlight song ${recommendations.spotlight.title}`}
                      onClick={() => handleSelectSong(recommendations.spotlight, true)}
                      className="mood-spotlight flex-shrink-0 group relative cursor-pointer block"
                    >
                      <div className="mood-spotlight-art relative p-2 rounded-3xl bg-white/10 border border-white/15 shadow-2xl backdrop-blur-xl group-hover:border-white/30 transition">
                        <SongCoverArt
                          song={recommendations.spotlight}
                          realCoverUrl={resolvedMedia[recommendations.spotlight.id]?.artworkUrl}
                          size="md"
                          isPlaying={isPlaying && currentSong?.id === recommendations.spotlight.id}
                        />
                        <div className="absolute inset-2 rounded-2xl bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                          <Play className="w-10 h-10 text-white fill-current" />
                        </div>
                      </div>
                      <div className="mood-spotlight-caption text-center mt-2">
                        <div className="mood-spotlight-title text-[11px] font-bold text-white truncate max-w-[130px] mx-auto">
                          {recommendations.spotlight.title}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate max-w-[130px] mx-auto">
                          Your discovery spotlight
                        </div>
                      </div>
                    </button>
                  </TiltedCard>
                )}
              </div>
            </div>

            {!isMobile && quickMoodShift}

            <section className="space-y-3.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg sm:text-xl font-extrabold text-white flex items-center gap-2">
                    <Music className="w-5 h-5 text-amber-400" />
                    <span>Made for Your Mood</span>
                  </h2>
                  <p className="hidden sm:block text-xs text-slate-400">
                    Full songs for {intentProfile.shortLabel.toLowerCase()} from mood playlists in your language. Streams from <a href="https://www.jiosaavn.com" target="_blank" rel="noreferrer" className="underline hover:text-slate-200">JioSaavn</a>.
                  </p>
                </div>

              </div>

              <div className="m-rail flex flex-wrap gap-2 items-center">
                <span className="hidden sm:inline text-[10px] uppercase tracking-widest text-slate-500 mr-1">Take me somewhere</span>
                {INTENT_PROFILES.map((intent) => <button key={intent.id} aria-pressed={currentIntent === intent.id} onClick={() => setCurrentIntent(intent.id)} className={`search-chip ${currentIntent === intent.id ? '!border-violet-400/60 !bg-violet-500/20 !text-violet-200' : ''}`}>{intent.shortLabel}</button>)}
              </div>
              {discoveryStatus === 'loading' ? (
                <div role="status" aria-label="Finding fresh music" className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="h-28 rounded-2xl bg-white/5 border border-white/5 motion-safe:animate-pulse" />)}<p className="text-xs text-violet-200">Finding fresh sounds for your selections...</p></div>
              ) : discoveryStatus === 'error' ? (
                <div role="alert" className="p-6 rounded-2xl border border-rose-400/20 bg-rose-500/10">
                  <h3 className="font-bold">The music service is taking a break.</h3><p className="text-sm text-slate-300 mt-2">{discovery.error}</p><button onClick={() => setDiscoveryRevision((value) => value + 1)} className="search-chip mt-4">Retry live discovery</button>
                </div>
              ) : recommendations.allScored.length === 0 ? (
                <div role="status" className="p-8 rounded-2xl border border-white/10 text-center"><Music className="w-8 h-8 mx-auto text-violet-300 mb-3" /><h3 className="font-bold">Let&apos;s try a different direction.</h3><p className="text-sm text-slate-400 mt-2">No full songs matched this mix. Change your intent or find a fresh mix.</p></div>
              ) : <p role="status" className="text-[11px] text-slate-500">Showing {filteredMadeForMood.length} of {recommendations.allScored.length} available mood picks. {recommendations.allScored.length > 6 ? 'Find a fresh mix to explore more.' : 'Try another mood or language for more variety.'}</p>}
              {discoveryStatus === 'ready' && discovery.error && (
                <div role="alert" className="text-xs text-amber-200">
                  <p>{discovery.error}</p>
                  <button type="button" className="search-chip mt-2" onClick={() => setDiscoveryRevision((value) => value + 1)}>Retry for more picks</button>
                </div>
              )}
              <div className="m-rail-rows grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {filteredMadeForMood.map((song) => {
                  const isCurrent = currentSong?.id === song.id;
                  const isLiked = likedSongIds.includes(song.id);

                  return (
                    <TiltedCard
                      key={song.id}
                      rotateAmplitude={6}
                      scaleOnHover={1.02}
                      glare={0.2}
                      className="h-full"
                    >
                      <div
                        onClick={() => handleSelectSong(song, true)}
                        className={`group p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center gap-3.5 relative overflow-hidden h-full ${
                          isCurrent
                            ? 'bg-white/15 border-white/40 shadow-xl ring-1 ring-white/20'
                            : 'bg-white/[0.03] hover:bg-white/[0.08] border-white/10'
                        }`}
                      >
                        <div className="relative flex-shrink-0">
                          <SongCoverArt
                            song={song}
                            realCoverUrl={resolvedMedia[song.id]?.artworkUrl}
                            size="sm"
                            isPlaying={isCurrent && isPlaying}
                          />
                          <button
                            type="button"
                            aria-label={`${isCurrent && isPlaying ? 'Pause' : 'Play'} ${song.title}`}
                            onClick={(event) => { event.stopPropagation(); handleSelectSong(song, true); }}
                            className={`absolute inset-0 rounded-xl bg-black/45 flex items-center justify-center transition focus:opacity-100 ${
                              isCurrent ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                            }`}
                          >
                            {isCurrent && isPlaying ? (
                              <Pause className="w-5 h-5 text-white fill-current" />
                            ) : (
                              <Play className="w-5 h-5 text-white fill-current ml-0.5" />
                            )}
                          </button>
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-sm text-white truncate group-hover:text-amber-200 transition">
                              {song.title}
                            </h3>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-slate-300 flex-shrink-0">
                              {song.language}
                            </span>
                          </div>
                          <p className="text-xs text-slate-300 truncate mt-0.5">{song.artist}</p>
                          <p className="text-[11px] text-slate-400 line-clamp-1 mt-1">
                            {song.matchWhy}
                          </p>
                        </div>

                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={(e) => handleToggleLike(song.id, e)}
                            className={`p-2 rounded-xl transition ${
                              isLiked
                                ? 'text-rose-400 bg-rose-500/15'
                                : 'text-slate-400 hover:text-white hover:bg-white/10'
                            }`}
                            title="Favorite"
                          >
                            <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
                          </button>
                        </div>
                      </div>
                    </TiltedCard>
                  );
                })}
              </div>
            </section>

            {recommendations.lastLiked && recommendations.becauseLiked.length > 0 && (
              <section className="rounded-3xl bg-gradient-to-r from-rose-500/10 via-purple-500/10 to-indigo-500/10 border border-rose-400/25 p-5 space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Heart className="w-4 h-4 text-rose-400 fill-current flex-shrink-0" />
                    <h2 className="text-sm sm:text-base font-bold text-white">
                      Because you liked{' '}
                      <span className="text-rose-300">&ldquo;{recommendations.lastLiked.title}&rdquo;</span>
                    </h2>
                  </div>
                  <span className="text-xs text-slate-400">Personalized Mix</span>
                </div>

                <div className="m-rail-rows grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {recommendations.becauseLiked.map((song) => {
                    const isCurrent = currentSong?.id === song.id;
                    const isLiked = likedSongIds.includes(song.id);
                    return (
                      <div
                        key={song.id}
                        onClick={() => handleSelectSong(song, true)}
                        className="p-3 rounded-2xl bg-black/40 hover:bg-black/60 border border-white/10 flex items-center gap-3 cursor-pointer transition group"
                      >
                        <SongCoverArt
                          song={song}
                          realCoverUrl={resolvedMedia[song.id]?.artworkUrl}
                          size="xs"
                          isPlaying={isCurrent && isPlaying}
                        />
                        <div className="flex-1 min-w-0">
                          <h4 className="text-xs sm:text-sm font-semibold text-white truncate group-hover:text-amber-200 transition">
                            {song.title}
                          </h4>
                          <p className="text-[11px] text-slate-400 truncate">
                            {song.artist} • {song.language}
                          </p>
                        </div>
                        <button
                          onClick={(e) => handleToggleLike(song.id, e)}
                          className={`p-1.5 rounded-lg flex-shrink-0 ${
                            isLiked ? 'text-rose-400' : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {isMobile && quickMoodShift}

            <section className="space-y-3.5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg sm:text-xl font-extrabold text-white">You Might Also Like</h2>
                  <p className="hidden sm:block text-xs text-slate-400">
                    Popular full songs from the artists in your mix.
                  </p>
                  <p className="sm:hidden text-[11px] text-slate-400">Popular songs from artists in your mix</p>
                </div>
                <button type="button" aria-label="Refresh suggestions" onClick={() => setSuggestionRevision((value) => value + 1)} disabled={discoveryStatus !== 'ready' || !discoveredSongs.length || suggestionStatus === 'loading'} className="search-chip shrink-0 disabled:opacity-40"><RefreshCw className="w-3.5 h-3.5" /><span className="hidden sm:inline">Refresh suggestions</span></button>
              </div>

              {discoveryStatus === 'loading' || (discoveredSongs.length > 0 && suggestionStatus === 'loading') ? (
                <p role="status" className="text-sm text-slate-400">Finding more from these artists...</p>
              ) : discoveryStatus === 'error' || !discoveredSongs.length ? (
                <p role="status" className="text-sm text-slate-400">Choose a mood mix to discover related artists.</p>
              ) : suggestionStatus === 'error' ? (
                <div role="alert" className="text-sm text-rose-200">
                  <p>{moodSuggestions.error}</p>
                  <button type="button" onClick={() => setSuggestionRevision((value) => value + 1)} className="search-chip mt-2">Retry suggestions</button>
                </div>
              ) : recommendations.youMightLike.length === 0 ? (
                <p role="status" className="text-sm text-slate-400">No more songs from these artists yet. Try a fresh mood mix.</p>
              ) : null}
              {suggestionStatus === 'ready' && moodSuggestions.error && <p role="alert" className="text-xs text-amber-200">{moodSuggestions.error}</p>}
              <div className="m-rail m-rail-cards grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5 sm:gap-4">
                {recommendations.youMightLike.map((song) => {
                  const isCurrent = currentSong?.id === song.id;
                  const isLiked = likedSongIds.includes(song.id);

                  return (
                    <div
                      key={song.id}
                      onClick={() => handleSelectSong(song, true)}
                      className={`group p-3 sm:p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                        isCurrent
                          ? 'bg-white/15 border-amber-400/60 shadow-xl'
                          : 'bg-white/[0.04] hover:bg-white/[0.08] border-white/10 hover:border-white/20'
                      }`}
                    >
                      <div>
                        <div className="relative mb-3 w-full">
                          <SongCoverArt
                            song={song}
                            realCoverUrl={resolvedMedia[song.id]?.artworkUrl}
                            size="card"
                            isPlaying={isCurrent && isPlaying}
                          />
                          <span className="absolute top-2 left-2 px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase rounded-full bg-black/70 text-white backdrop-blur-md border border-white/15 pointer-events-none">
                            {song.language}
                          </span>
                          <button
                            aria-label={`Play ${song.title}`}
                            className="absolute bottom-2.5 right-2.5 w-9 h-9 rounded-full bg-white text-slate-950 shadow-xl flex items-center justify-center group-hover:scale-110 transition transform"
                          >
                            {isCurrent && isPlaying ? (
                              <Pause className="w-4 h-4 fill-current" />
                            ) : (
                              <Play className="w-4 h-4 fill-current ml-0.5" />
                            )}
                          </button>
                        </div>

                        <div className="flex items-start justify-between gap-1.5">
                          <h4 className="font-bold text-sm text-white leading-snug line-clamp-1 group-hover:text-amber-200 transition">
                            {song.title}
                          </h4>
                          <button
                            onClick={(e) => handleToggleLike(song.id, e)}
                            className={`p-0.5 rounded transition flex-shrink-0 ${
                              isLiked ? 'text-rose-400' : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            <Heart className={`w-3.5 h-3.5 ${isLiked ? 'fill-current' : ''}`} />
                          </button>
                        </div>
                        <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">{song.artist}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        )}
      </div>

      {(screen === 'home' || activeSong) && currentSong && isPlayerVisible && (
        <div className="fixed bottom-0 inset-x-0 z-30 flex justify-center px-3 pb-3 pointer-events-none transition-all duration-300">
          <div className="pointer-events-auto w-full max-w-5xl rounded-3xl bg-slate-900/80 border border-white/15 shadow-2xl backdrop-blur-2xl px-4 py-3">
            <div className="flex items-center gap-2.5 mb-2.5">
              <span className="text-[10px] font-mono text-slate-400 w-7 text-right">
                {formatDuration(progressSec)}
              </span>
              <div
                onClick={handleSeek}
                className="flex-1 h-2 bg-white/10 hover:h-2.5 rounded-full overflow-hidden cursor-pointer relative transition-all"
                title="Click to seek"
              >
                <div
                  className={`h-full bg-gradient-to-r ${moodProfile.cardGradient} transition-all duration-150`}
                  style={{
                    width: `${Math.min(100, (progressSec / trackDuration) * 100)}%`
                  }}
                />
              </div>
              <span className="text-[10px] font-mono text-slate-400 w-7">
                {formatDuration(trackDuration)}
              </span>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div
                onClick={() => setIsFullPlayerOpen(true)}
                className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer group"
              >
                <SongCoverArt
                  song={currentSong}
                  realCoverUrl={currentSong.realCoverUrl}
                  size="xs"
                  isPlaying={isPlaying}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-xs sm:text-sm text-white truncate group-hover:underline">
                      {currentSong.title}
                    </h4>
                    <span className="hidden sm:inline-block text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-slate-300">
                      {currentSong.language}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 truncate">
                    {currentSong.artist} •{' '}
                    <span className="text-amber-300/90">Tap for queue & volume</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 sm:gap-2">
                <button
                  onClick={(e) => handleToggleLike(currentSong.id, e)}
                  className={`p-2 rounded-full transition ${
                    likedSongIds.includes(currentSong.id)
                      ? 'text-rose-400 bg-rose-500/15'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Favorite"
                >
                  <Heart
                    className={`w-4 h-4 ${likedSongIds.includes(currentSong.id) ? 'fill-current' : ''}`}
                  />
                </button>

                <button
                  onClick={handlePrevSong}
                  className="p-2 rounded-full text-slate-300 hover:text-white hover:bg-white/10 transition"
                  title="Previous"
                >
                  <SkipBack className="w-4 h-4" />
                </button>

                <button
                  onClick={handleTogglePlay}
                  className={`w-10 h-10 rounded-2xl bg-gradient-to-r ${moodProfile.cardGradient} text-white flex items-center justify-center shadow-lg hover:opacity-95 transition`}
                  title={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying ? (
                    <Pause className="w-5 h-5 fill-current" />
                  ) : (
                    <Play className="w-5 h-5 fill-current ml-0.5" />
                  )}
                </button>

                <button
                  onClick={() => handleNextSong(true)}
                  className="p-2 rounded-full text-slate-300 hover:text-white hover:bg-white/10 transition"
                  title="Next"
                >
                  <SkipForward className="w-4 h-4" />
                </button>

                <div className="hidden sm:flex">
                  <VolumeControl
                    variant="compact"
                    level={volumeState.level}
                    muted={isMuted}
                    supported={volumeSupported}
                    accent={volumeAccent}
                    onChange={handleVolumeChange}
                    onToggleMute={handleToggleMute}
                  />
                </div>

                <button
                  onClick={() => setIsFullPlayerOpen(true)}
                  className="hidden sm:inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-medium text-white transition"
                >
                  <ListMusic className="w-3.5 h-3.5" />
                  <span>Player</span>
                </button>

                <button
                  onClick={handleStopAndClosePlayer}
                  className="p-2 rounded-full text-slate-400 hover:text-rose-400 hover:bg-white/10 transition"
                  title="Stop & Close Player"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isFullPlayerOpen && currentSong && (
        <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-2xl overflow-y-auto flex flex-col items-center p-4 sm:p-8 pb-28 sm:pb-28 animate-in fade-in">
          <div className="w-full max-w-4xl my-auto">
            <div className="flex items-center justify-between pb-6 border-b border-white/10">
              <button
                onClick={() => setIsFullPlayerOpen(false)}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-white/10 hover:bg-white/15 text-xs sm:text-sm font-medium text-white transition"
              >
                <ChevronDown className="w-4 h-4" />
                <span>Minimize Player</span>
              </button>

              <div className="text-center">
                <div className="text-[11px] uppercase tracking-widest text-slate-400">
                  {radioSeed ? 'Playing from Song Radio' : 'Playing from Mood Mix'}
                </div>
                <div className="text-xs sm:text-sm font-bold text-amber-300">
                  {radioSeed ? radioSeed.title : playlistTitle}
                </div>
              </div>

              <button
                onClick={handleToggleMute}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-2xl border text-xs font-medium transition ${
                  !isMuted
                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                    : 'bg-white/5 border-white/10 text-slate-400'
                }`}
                aria-label={isMuted ? 'Unmute' : 'Mute'}
              >
                <VolumeIcon level={volumeState.level} muted={isMuted} className="w-4 h-4" />
                <span className="hidden sm:inline">{isMuted ? 'Muted' : 'Sound On'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 py-6 items-center">
              <div className="lg:col-span-6 flex flex-col items-center text-center">
                <div className="mb-6 w-full flex justify-center">
                  <SongCoverArt
                    song={currentSong}
                    realCoverUrl={currentSong.realCoverUrl}
                    size="lg"
                    isPlaying={isPlaying}
                  />
                </div>

                <div className="w-full max-w-sm flex items-center justify-between gap-3 mb-4">
                  <div className="text-left min-w-0">
                    <h2 className="text-2xl font-extrabold text-white truncate">
                      {currentSong.title}
                    </h2>
                    <p className="text-sm text-slate-300 truncate">
                      {currentSong.artist} • {currentSong.album}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={(e) => handleToggleLike(currentSong.id, e)}
                      className={`p-2.5 rounded-2xl border transition ${
                        likedSongIds.includes(currentSong.id)
                          ? 'bg-rose-500/20 border-rose-500/40 text-rose-400'
                          : 'bg-white/5 border-white/10 text-slate-300 hover:text-white'
                      }`}
                      title="Favorite"
                    >
                      <Heart
                        className={`w-5 h-5 ${
                          likedSongIds.includes(currentSong.id) ? 'fill-current' : ''
                        }`}
                      />
                    </button>
                    <button
                      onClick={(e) => handleDislikeSong(currentSong.id, e)}
                      className="p-2.5 rounded-2xl bg-white/5 border border-white/10 text-slate-400 hover:text-rose-300 transition"
                      title="Dislike & Skip"
                    >
                      <ThumbsDown className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <div className="w-full max-w-sm space-y-1.5 mb-5">
                  <div
                    onClick={handleSeek}
                    className="w-full h-2 bg-white/15 rounded-full overflow-hidden cursor-pointer"
                  >
                    <div
                      className={`h-full bg-gradient-to-r ${moodProfile.cardGradient}`}
                      style={{
                        width: `${Math.min(100, (progressSec / trackDuration) * 100)}%`
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-slate-400 font-mono">
                    <span>{formatDuration(progressSec)}</span>
                    <span>{formatDuration(trackDuration)}</span>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-5">
                  <button
                    onClick={() => setIsShuffle((prev) => !prev)}
                    className={`p-2.5 rounded-full transition ${
                      isShuffle ? 'text-amber-400 bg-amber-500/15' : 'text-slate-400 hover:text-white'
                    }`}
                    title="Shuffle"
                  >
                    <Shuffle className="w-4 h-4" />
                  </button>

                  <button
                    onClick={handlePrevSong}
                    className="p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition"
                    title="Previous"
                  >
                    <SkipBack className="w-5 h-5" />
                  </button>

                  <button
                    onClick={handleTogglePlay}
                    className={`play-glow w-16 h-16 rounded-3xl bg-gradient-to-r ${moodProfile.cardGradient} text-white flex items-center justify-center shadow-2xl hover:scale-105 active:scale-95 transition ${isPlaying ? 'is-playing' : ''}`}
                    style={{ '--glow': volumeAccent[0] }}
                    title={isPlaying ? 'Pause' : 'Play'}
                  >
                    {isPlaying ? (
                      <Pause className="w-7 h-7 fill-current" />
                    ) : (
                      <Play className="w-7 h-7 fill-current ml-0.5" />
                    )}
                  </button>

                  <button
                    onClick={() => handleNextSong(true)}
                    className="p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition"
                    title="Next"
                  >
                    <SkipForward className="w-5 h-5" />
                  </button>

                  <button
                    onClick={() => setIsRepeat((prev) => !prev)}
                    className={`p-2.5 rounded-full transition ${
                      isRepeat ? 'text-emerald-400 bg-emerald-500/15' : 'text-slate-400 hover:text-white'
                    }`}
                    title="Repeat"
                  >
                    <Repeat className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="lg:col-span-6 space-y-5">
                <div className="rounded-3xl bg-white/[0.03] border border-white/10 p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <ListMusic className="w-4 h-4 text-emerald-400" />
                      <span>{radioSeed ? `Song radio · ${radioSeed.title}` : 'Up Next in Your Mood Queue'}</span>
                    </h3>
                    <span className="text-xs text-slate-400">{radioSeed ? 'Autoplay' : 'Dynamically adapting'}</span>
                  </div>
                  {radioSeed && <>
                    <p className="text-xs text-slate-400">Closest matches to the playing song first (style, artist, genre), then picks from your mood mix and same-genre searches. Metadata-based, not audio analysis.</p>
                    {radioStatus === 'loading' && <p role="status" className="text-xs text-violet-200">Finding similar songs for autoplay...</p>}
                    {radioStatus === 'error' && <div role="alert" className="text-sm text-rose-200"><p>{radio.error}</p><button className="search-chip mt-2" onClick={() => setRadioRevision((value) => value + 1)}>Retry song radio</button></div>}
                    {radioStatus === 'ready' && radio.error && <div role="alert" className="text-xs text-amber-200"><p>{radio.error}</p><button className="search-chip mt-2" onClick={() => setRadioRevision((value) => value + 1)}>Retry for more songs</button></div>}
                    {radioStatus === 'ready' && radioSongs.length > 0 && <p role="status" className="text-xs text-emerald-200">{radioSongs.length} songs lined up for autoplay{radioSongs.length < RADIO_MIN_SONGS ? ' — only these related songs were found' : ''}.</p>}
                    {radioStatus === 'ready' && radioSongs.length === 0 && <p role="status" className="text-xs text-slate-300">No more related songs found. Autoplay won&apos;t switch to unrelated songs. Choose another song to continue.</p>}
                  </>}

                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {queueList.map((item, idx) => {
                      const isCurrent = item.id === currentSong.id;
                      const isLiked = likedSongIds.includes(item.id);
                      return (
                        <div
                          key={item.id}
                          onClick={() => handleSelectSong(item, true, { preserveRadio: true })}
                          className={`p-2.5 rounded-2xl border flex items-center gap-3 cursor-pointer transition ${
                            isCurrent
                              ? 'bg-white/15 border-white/30'
                              : 'bg-black/25 hover:bg-white/10 border-white/5'
                          }`}
                        >
                          <span className="text-xs font-mono text-slate-500 w-4 text-center">
                            {idx + 1}
                          </span>
                          <SongCoverArt
                            song={item}
                            realCoverUrl={resolvedMedia[item.id]?.artworkUrl}
                            size="xs"
                            isPlaying={isCurrent && isPlaying}
                          />
                          <div className="flex-1 min-w-0">
                            <h4 className="text-xs sm:text-sm font-semibold text-white truncate">
                              {item.title}
                            </h4>
                            <p className="text-[11px] text-slate-400 truncate">
                              {item.artist} • {item.language}
                            </p>
                          </div>
                          <button
                            onClick={(e) => handleToggleLike(item.id, e)}
                            className={`p-1.5 rounded-lg ${
                              isLiked ? 'text-rose-400' : 'text-slate-500 hover:text-white'
                            }`}
                          >
                            <Heart className={`w-3.5 h-3.5 ${isLiked ? 'fill-current' : ''}`} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <VolumeControl
                  level={volumeState.level}
                  muted={isMuted}
                  supported={volumeSupported}
                  accent={volumeAccent}
                  onChange={handleVolumeChange}
                  onToggleMute={handleToggleMute}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {isMoodModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/15 rounded-3xl max-w-xl w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-white">Tune Your Mood & Vibe</h3>
                <p className="text-xs text-slate-400">
                  Update your state of mind or listening direction at any time.
                </p>
              </div>
              <button
                onClick={() => setIsMoodModalOpen(false)}
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                1. Current Mood
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {MOOD_PROFILES.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setCurrentMood(m.id)}
                    className={`p-2.5 rounded-xl border text-xs font-semibold text-left transition flex items-center gap-2 ${
                      currentMood === m.id
                        ? 'bg-white text-slate-950 border-white'
                        : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
                    }`}
                  >
                    <Music className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">{m.shortLabel}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                2. Listening Goal
              </label>
              <div className="flex flex-wrap gap-2">
                {INTENT_PROFILES.map((intent) => (
                  <button
                    key={intent.id}
                    onClick={() => setCurrentIntent(intent.id)}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-medium transition ${
                      currentIntent === intent.id
                        ? 'bg-amber-400 text-slate-950 font-bold border-amber-300'
                        : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
                    }`}
                  >
                    {intent.shortLabel}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                3. Preferred Language / Style
              </label>
              <div className="flex flex-wrap gap-2">
                {LANGUAGE_PROFILES.map((lang) => (
                  <button
                    key={lang.id}
                    onClick={() => {
                      setCurrentLanguage(lang.id);
                      setActiveLangFilter('All');
                    }}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-medium transition ${
                      currentLanguage === lang.id
                        ? 'bg-rose-500 text-white font-bold border-rose-400'
                        : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
                    }`}
                  >
                    {lang.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setIsMoodModalOpen(false);
                  setQuizStep(0);
                  setScreen('quiz');
                }}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-medium text-slate-300"
              >
                Full 3-Step Quiz
              </button>
              <button
                onClick={() => {
                  setIsMoodModalOpen(false);
                  triggerToast('Mood updated & recommendations refreshed');
                }}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 text-white font-bold text-xs sm:text-sm shadow-lg"
              >
                Apply & Refresh
              </button>
            </div>
          </div>
        </div>
      )}
    </ClickSpark>
  );
}
