import { ARABIC_100_SONGS, ArabicSong } from '../data/arabicSongsData';
import { ARABIC_RADIO_STATIONS, ArabicRadioStation } from '../data/arabicRadioData';

export type RadioPlayerTab = 'radio' | 'songs';
export type RadioPlayMode = 'sequential' | 'shuffle' | 'repeat_one';

export interface RadioPlayerSnapshot {
  activeTab: RadioPlayerTab;
  activeSong: ArabicSong;
  activeStation: ArabicRadioStation;
  isPlaying: boolean;
  isLoading: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  playMode: RadioPlayMode;
  autoplayBlocked: boolean;
}

export function getSongAudioSource(song: ArabicSong): string {
  if (song.artist.includes('عمرو دياب')) {
    if (song.title.includes('قمرين')) {
      return 'https://archive.org/download/y-2meta.app-amr-diab-amarain-official-music-video-hd-version-128-kbps/Y2meta.app%20-%20Amr%20Diab%20-%20Amarain%20_%20Official%20Music%20Video%20-%20HD%20Version%20_%20%D8%B9%D9%85%D8%B1%D9%88%20%D8%AF%D9%8A%D8%A7%D8%A8%20-%20%D9%82%D9%85%D8%B1%D9%8A%D9%86%20%28128%20kbps%29.mp3';
    }
    return 'https://stream.zeno.fm/8a4eqkd0pnhvv';
  }
  if (song.artist.includes('أم كلثوم')) {
    if (song.title.includes('الأطلال') || song.id === 'song_4') {
      return 'https://archive.org/download/umm-kulthum-enta-el-hobal-ahat/02%20Al%20Ahat.mp3';
    }
    return 'https://archive.org/download/umm-kulthum-enta-el-hobal-ahat/01%20Inta%20Al%20Hob.mp3';
  }
  if (song.artist.includes('عبد الحليم')) {
    return 'https://archive.org/download/y-2mate.com-ala-hesb-wedad-abdel-halim-hafez_202305/y2mate.com%20-%20Ala%20Hesb%20Wedad%20%20Abdel%20Halim%20Hafez%20%20%D8%B9%D9%84%D9%89%20%D8%AD%D8%B3%D8%A8%20%D9%88%D8%AF%D8%A7%D8%AF%20%D9%82%D9%84%D8%A8%D9%89%20%20%D8%B9%D8%A8%D8%AF%20%D8%A7%D9%84%D8%AD%D9%84%D9%8A%D9%85%20%D8%AD%D8%A7%D9%81%D8%B8.mp3';
  }
  if (song.artist.includes('فيروز')) {
    return 'https://stream.zeno.fm/xkhnk4vee18uv';
  }
  if (song.artist.includes('عبد المجيد') || song.artist.includes('محمد عبده') || song.category === 'khaleeji') {
    return 'https://archive.org/download/y-2meta.app-amr-diab-amarain-official-music-video-hd-version-128-kbps/Y2meta.app%20-%20%D8%B9%D8%A8%D8%AF%D8%A7%D9%84%D9%85%D8%AC%D9%8A%D8%AF%20%D8%B9%D8%A8%D8%AF%D8%A7%D9%84%D9%84%D9%87%20-%20%D9%8a%D8%A7%20%D8%A3%D8%A8%D9%86%20%D8%A7%D9%84%D8%A7%D9%88%D8%A7%D8%AF%D9%85%20%28%D8%A3%D9%84%D8%A8%D9%88%D9%85%20%D8%B9%D8%A7%D9%84%D9%85%20%D9%85%D9%88%D8%A7%D8%B2%D9%8a%29%20_%202021%20%28128%20kbps%29.mp3';
  }
  if (song.artist.includes('نانسي') || song.category === 'levantine') {
    return 'https://archive.org/download/y-2meta.app-amr-diab-amarain-official-music-video-hd-version-128-kbps/Y2meta.app%20-%20Nancy%20Ajram%20-%20Aam%20Betghayar%20_%20Romanized%20Lyrics%20_%20%D9%86%D8%A7%D9%86%D8%B3%D9%8A%20%D8%B9%D8%AC%D8%B1%D9%85%20-%20%D8%B9%D9%85%20%D8%A8%D8%AA%D8%BA%D9%8A%D9%91%D8%B1%20%28128%20kbps%29.mp3';
  }
  if (song.category === 'shaabi') {
    return 'https://stream.zeno.fm/8a4eqkd0pnhvv';
  }
  if (song.category === 'classic') {
    return 'https://oriental-high.rautemusik.fm/?ref=radiobrowser';
  }
  return 'https://medinatarab.ice.infomaniak.ch/medinatarab-128.mp3';
}

class GlobalRadioPlayerService {
  private audio: HTMLAudioElement | null = null;
  private listeners: Set<(snap: RadioPlayerSnapshot) => void> = new Set();
  private userPausedManually = false;
  private autoplayAttempted = false;

  private state: RadioPlayerSnapshot = {
    activeTab: 'radio',
    activeSong: ARABIC_100_SONGS[0],
    activeStation: ARABIC_RADIO_STATIONS[0],
    isPlaying: false,
    isLoading: false,
    currentTime: 0,
    duration: 240,
    volume: 0.75,
    isMuted: false,
    playMode: 'sequential',
    autoplayBlocked: false
  };

  private ensureAudio() {
    if (typeof window === 'undefined') return null;
    if (!this.audio) {
      const audio = new Audio();
      audio.preload = 'none';
      audio.volume = this.state.isMuted ? 0 : this.state.volume;

      audio.onplaying = () => {
        this.state = { ...this.state, isLoading: false, isPlaying: true, autoplayBlocked: false };
        this.emit();
      };
      audio.onwaiting = () => {
        this.state = { ...this.state, isLoading: true };
        this.emit();
      };
      audio.onpause = () => {
        this.state = { ...this.state, isPlaying: false, isLoading: false };
        this.emit();
      };
      audio.ontimeupdate = () => {
        const dur = audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)
          ? audio.duration
          : this.state.duration;
        this.state = { ...this.state, currentTime: audio.currentTime, duration: dur };
        this.emit();
      };
      audio.onended = () => {
        if (this.state.activeTab === 'songs') {
          this.next();
        }
      };
      audio.onerror = () => {
        this.state = { ...this.state, isLoading: false, isPlaying: false };
        this.emit();
      };

      this.audio = audio;
    }
    return this.audio;
  }

  private emit() {
    const snap = { ...this.state };
    this.listeners.forEach((cb) => {
      try {
        cb(snap);
      } catch {}
    });
  }

  getSnapshot(): RadioPlayerSnapshot {
    return { ...this.state };
  }

  subscribe(callback: (snap: RadioPlayerSnapshot) => void): () => void {
    this.listeners.add(callback);
    callback(this.getSnapshot());
    return () => {
      this.listeners.delete(callback);
    };
  }

  setTab(tab: RadioPlayerTab) {
    this.state = { ...this.state, activeTab: tab };
    this.emit();
  }

  setPlayMode(mode: RadioPlayMode) {
    this.state = { ...this.state, playMode: mode };
    this.emit();
  }

  setVolume(vol: number) {
    const clamped = Math.max(0, Math.min(1, vol));
    this.state = { ...this.state, volume: clamped, isMuted: clamped === 0 };
    if (this.audio) {
      this.audio.volume = this.state.isMuted ? 0 : clamped;
    }
    this.emit();
  }

  toggleMute() {
    const nextMuted = !this.state.isMuted;
    this.state = { ...this.state, isMuted: nextMuted };
    if (this.audio) {
      this.audio.volume = nextMuted ? 0 : this.state.volume;
    }
    this.emit();
  }

  seek(timeSec: number) {
    this.state = { ...this.state, currentTime: timeSec };
    if (this.audio && isFinite(timeSec)) {
      this.audio.currentTime = timeSec;
    }
    this.emit();
  }

  tryAutoPlayFM() {
    if (typeof window === 'undefined' || this.autoplayAttempted || this.userPausedManually) return;
    if (localStorage.getItem('shat_masr_radio_autoplay') === 'off') return;
    this.autoplayAttempted = true;
    const audio = this.ensureAudio();
    if (!audio) return;

    this.state = {
      ...this.state,
      activeTab: 'radio',
      isLoading: true
    };
    this.emit();

    audio.src = this.state.activeStation.streamUrl;
    audio.play()
      .then(() => {
        this.state = { ...this.state, isPlaying: true, isLoading: false, autoplayBlocked: false };
        this.emit();
      })
      .catch(() => {
        this.state = { ...this.state, isPlaying: false, isLoading: false, autoplayBlocked: true };
        this.emit();

        // Resume cleanly on first user pointer gesture if browser blocked initial autoplay
        const resumeOnGesture = () => {
          if (!this.userPausedManually && !this.state.isPlaying && localStorage.getItem('shat_masr_radio_autoplay') !== 'off') {
            this.playCurrent();
          }
          window.removeEventListener('pointerdown', resumeOnGesture);
        };
        window.addEventListener('pointerdown', resumeOnGesture, { once: true });
      });
  }

  selectSong(song: ArabicSong) {
    this.userPausedManually = false;
    const audio = this.ensureAudio();
    this.state = {
      ...this.state,
      activeTab: 'songs',
      activeSong: song,
      currentTime: 0,
      duration: song.durationSeconds || 240,
      isLoading: true
    };
    this.emit();
    if (audio) {
      audio.src = getSongAudioSource(song);
      audio.play()
        .then(() => {
          this.state = { ...this.state, isPlaying: true, isLoading: false, autoplayBlocked: false };
          this.emit();
        })
        .catch(() => {
          this.state = { ...this.state, isLoading: false, autoplayBlocked: true };
          this.emit();
        });
    }
  }

  selectStation(station: ArabicRadioStation) {
    this.userPausedManually = false;
    const audio = this.ensureAudio();
    this.state = {
      ...this.state,
      activeTab: 'radio',
      activeStation: station,
      isLoading: true
    };
    this.emit();
    if (audio) {
      audio.src = station.streamUrl;
      audio.play()
        .then(() => {
          this.state = { ...this.state, isPlaying: true, isLoading: false, autoplayBlocked: false };
          this.emit();
        })
        .catch(() => {
          this.state = { ...this.state, isLoading: false, autoplayBlocked: true };
          this.emit();
        });
    }
  }

  playCurrent() {
    this.userPausedManually = false;
    localStorage.setItem('shat_masr_radio_autoplay', 'on');
    const audio = this.ensureAudio();
    if (!audio) return;
    const targetUrl =
      this.state.activeTab === 'songs'
        ? getSongAudioSource(this.state.activeSong)
        : this.state.activeStation.streamUrl;
    this.state = { ...this.state, isLoading: true };
    this.emit();
    if (audio.src !== targetUrl) {
      audio.src = targetUrl;
    }
    audio.play()
      .then(() => {
        this.state = { ...this.state, isPlaying: true, isLoading: false, autoplayBlocked: false };
        this.emit();
      })
      .catch(() => {
        this.state = { ...this.state, isLoading: false, isPlaying: false };
        this.emit();
      });
  }

  pause() {
    this.userPausedManually = true;
    localStorage.setItem('shat_masr_radio_autoplay', 'off');
    if (this.audio) {
      this.audio.pause();
    }
    this.state = { ...this.state, isPlaying: false, isLoading: false, autoplayBlocked: false };
    this.emit();
  }

  togglePlay() {
    if (this.state.isPlaying) {
      this.pause();
    } else {
      this.playCurrent();
    }
  }

  next() {
    if (this.state.activeTab === 'radio') {
      const idx = ARABIC_RADIO_STATIONS.findIndex(s => s.id === this.state.activeStation.id);
      const nextStation = ARABIC_RADIO_STATIONS[(idx + 1) % ARABIC_RADIO_STATIONS.length];
      this.selectStation(nextStation);
      return;
    }
    const current = this.state.activeSong;
    if (this.state.playMode === 'repeat_one') {
      this.selectSong(current);
      return;
    }
    if (this.state.playMode === 'shuffle') {
      const others = ARABIC_100_SONGS.filter(s => s.id !== current.id);
      const randomSong = others[Math.floor(Math.random() * others.length)] || ARABIC_100_SONGS[0];
      this.selectSong(randomSong);
      return;
    }
    const idx = ARABIC_100_SONGS.findIndex(s => s.id === current.id);
    this.selectSong(ARABIC_100_SONGS[(idx + 1) % ARABIC_100_SONGS.length]);
  }

  prev() {
    if (this.state.activeTab === 'radio') {
      const idx = ARABIC_RADIO_STATIONS.findIndex(s => s.id === this.state.activeStation.id);
      const prevStation = ARABIC_RADIO_STATIONS[(idx - 1 + ARABIC_RADIO_STATIONS.length) % ARABIC_RADIO_STATIONS.length];
      this.selectStation(prevStation);
      return;
    }
    const current = this.state.activeSong;
    if (this.state.playMode === 'shuffle') {
      const others = ARABIC_100_SONGS.filter(s => s.id !== current.id);
      const randomSong = others[Math.floor(Math.random() * others.length)] || ARABIC_100_SONGS[0];
      this.selectSong(randomSong);
      return;
    }
    const idx = ARABIC_100_SONGS.findIndex(s => s.id === current.id);
    this.selectSong(ARABIC_100_SONGS[(idx - 1 + ARABIC_100_SONGS.length) % ARABIC_100_SONGS.length]);
  }
}

export const globalRadioPlayer = new GlobalRadioPlayerService();
