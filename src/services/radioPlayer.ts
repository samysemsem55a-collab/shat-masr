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

const ARCHIVE_TRACKS = {
  amr_amarain: 'https://archive.org/download/y-2meta.app-amr-diab-amarain-official-music-video-hd-version-128-kbps/Y2meta.app%20-%20Amr%20Diab%20-%20Amarain%20_%20Official%20Music%20Video%20-%20HD%20Version%20_%20%D8%B9%D9%85%D8%B1%D9%88%20%D8%AF%D9%8A%D8%A7%D8%A8%20-%20%D9%82%D9%85%D8%B1%D9%8A%D9%86%20%28128%20kbps%29.mp3',
  amr_ragein: 'https://archive.org/download/ragein/01%20Ragein.mp3',
  amr_ma_yethekish: 'https://archive.org/download/ragein/02%20Ma%20Yethekish%20Alieha.mp3',
  amr_ensa_alby: 'https://archive.org/download/ragein/03%20Ensa%20Alby.mp3',
  amr_we_regeat: 'https://archive.org/download/ragein/04%20We%20Regeat%20Men%20El%20Safar.mp3',
  amr_ha_ansak: 'https://archive.org/download/ragein/05%20Ha%20Ansak%20Ana.mp3',
  amr_sadaateny: 'https://archive.org/download/ragein/06%20Sadaateny.mp3',
  amr_habiby: 'https://archive.org/download/habiby_202108/01%20Habiby.mp3',
  amr_ramany: 'https://archive.org/download/habiby_202108/02%20Wi%20Ramany%20El%20Shouq.mp3',
  amr_khalik: 'https://archive.org/download/10.-khalik-maaaya/10.Khalik_Maaaya.mp3',
  umm_enta_al_hob: 'https://archive.org/download/umm-kulthum-enta-el-hobal-ahat/01%20Inta%20Al%20Hob.mp3',
  umm_al_ahat: 'https://archive.org/download/umm-kulthum-enta-el-hobal-ahat/02%20Al%20Ahat.mp3',
  umm_alf_leila: 'https://archive.org/download/umm-kulthum-alf-leila-we-leila-mcs-6q-mc-uu-ly/Umm%20Kulthum%20-%20Alf%20Leila%20We%20Leila%20%EF%BD%9C%20%D8%A7%D9%85%20%D9%83%D9%84%D8%AB%D9%88%D9%85%20-%20%D8%A7%D9%84%D9%81%20%D9%84%D9%8A%D9%84%D8%A9%20%D9%88%D9%84%D9%8A%D9%84%D8%A9%20%EF%BD%9C%20%D8%AA%D8%B3%D8%AC%D9%8A%D9%84%20%D8%B3%D8%AA%D9%88%D8%AF%D9%8A%D9%88%20%5BMCs6qMcUuLY%5D.mp3',
  halim_ala_hesb: 'https://archive.org/download/y-2mate.com-ala-hesb-wedad-abdel-halim-hafez_202305/y2mate.com%20-%20Ala%20Hesb%20Wedad%20%20Abdel%20Halim%20Hafez%20%20%D8%B9%D9%84%D9%89%20%D8%AD%D8%B3%D8%A8%20%D9%88%D8%AF%D8%A7%D8%AF%20%D9%82%D9%84%D8%A8%D9%89%20%20%D8%B9%D8%A8%D8%AF%20%D8%A7%D9%84%D8%AD%D9%84%D9%8A%D9%85%20%D8%AD%D8%A7%D9%81%D8%B8.mp3',
  khaleeji_majeed: 'https://archive.org/download/y-2meta.app-amr-diab-amarain-official-music-video-hd-version-128-kbps/Y2meta.app%20-%20%D8%B9%D8%A8%D8%AF%D8%A7%D9%84%D9%85%D8%AC%D9%8A%D8%AF%20%D8%B9%D8%A8%D8%AF%D8%A7%D9%84%D9%84%D9%87%20-%20%D9%8a%D8%A7%20%D8%A3%D8%A8%D9%86%20%D8%A7%D9%84%D8%A7%D9%88%D8%A7%D8%AF%D9%85%20%28%D8%A3%D9%84%D8%A8%D9%88%D9%85%20%D8%B9%D8%A7%D9%84%D9%85%20%D9%85%D9%88%D8%A7%D8%B2%D9%8a%29%20_%202021%20%28128%20kbps%29.mp3',
  nancy_betghayar: 'https://archive.org/download/y-2meta.app-amr-diab-amarain-official-music-video-hd-version-128-kbps/Y2meta.app%20-%20Nancy%20Ajram%20-%20Aam%20Betghayar%20_%20Romanized%20Lyrics%20_%20%D9%86%D8%A7%D9%86%D8%B3%D9%8A%20%D8%B9%D8%AC%D8%B1%D9%85%20-%20%D8%B9%D9%85%20%D8%A8%D8%AA%D8%BA%D9%8A%D9%91%D8%B1%20%28128%20kbps%29.mp3',
};

const MODERN_POOL = [
  ARCHIVE_TRACKS.amr_amarain,
  ARCHIVE_TRACKS.amr_khalik,
  ARCHIVE_TRACKS.amr_ragein,
  ARCHIVE_TRACKS.amr_habiby,
  ARCHIVE_TRACKS.amr_ensa_alby,
  ARCHIVE_TRACKS.amr_sadaateny,
  ARCHIVE_TRACKS.nancy_betghayar,
];

const TARAB_POOL = [
  ARCHIVE_TRACKS.umm_enta_al_hob,
  ARCHIVE_TRACKS.umm_alf_leila,
  ARCHIVE_TRACKS.umm_al_ahat,
  ARCHIVE_TRACKS.halim_ala_hesb,
];

const CLASSIC_POOL = [
  ARCHIVE_TRACKS.halim_ala_hesb,
  ARCHIVE_TRACKS.amr_ma_yethekish,
  ARCHIVE_TRACKS.amr_we_regeat,
  ARCHIVE_TRACKS.amr_ramany,
  ARCHIVE_TRACKS.umm_enta_al_hob,
];

function pickTrackById(id: string, pool: string[]): string {
  let num = 0;
  for (let i = 0; i < id.length; i++) {
    num = (num * 31 + id.charCodeAt(i)) >>> 0;
  }
  return pool[num % pool.length];
}

export function getSongAudioSource(song: ArabicSong): string {
  if (song.audioUrl) return song.audioUrl;

  if (song.artist.includes('أم كلثوم')) {
    if (song.title.includes('ألف ليلة') || song.id === 'song_2') return ARCHIVE_TRACKS.umm_alf_leila;
    if (song.title.includes('الأطلال') || song.id === 'song_4') return ARCHIVE_TRACKS.umm_al_ahat;
    return ARCHIVE_TRACKS.umm_enta_al_hob;
  }
  if (song.artist.includes('عبد الحليم')) {
    return ARCHIVE_TRACKS.halim_ala_hesb;
  }
  if (song.artist.includes('عمرو دياب')) {
    if (song.title.includes('قمرين')) return ARCHIVE_TRACKS.amr_amarain;
    if (song.title.includes('راجعين')) return ARCHIVE_TRACKS.amr_ragein;
    if (song.title.includes('تملي معاك') || song.title.includes('نور العين')) return ARCHIVE_TRACKS.amr_habiby;
    if (song.title.includes('أنت الحظ') || song.title.includes('وياه')) return ARCHIVE_TRACKS.amr_khalik;
    return pickTrackById(song.id, [
      ARCHIVE_TRACKS.amr_amarain,
      ARCHIVE_TRACKS.amr_ragein,
      ARCHIVE_TRACKS.amr_khalik,
      ARCHIVE_TRACKS.amr_ensa_alby,
      ARCHIVE_TRACKS.amr_ha_ansak,
      ARCHIVE_TRACKS.amr_sadaateny,
    ]);
  }
  if (song.artist.includes('عبد المجيد') || song.artist.includes('محمد عبده') || song.category === 'khaleeji') {
    return ARCHIVE_TRACKS.khaleeji_majeed;
  }
  if (song.artist.includes('فيروز') || song.artist.includes('نانسي') || song.category === 'levantine') {
    return ARCHIVE_TRACKS.nancy_betghayar;
  }
  if (song.category === 'tarab') {
    return pickTrackById(song.id, TARAB_POOL);
  }
  if (song.category === 'classic') {
    return pickTrackById(song.id, CLASSIC_POOL);
  }
  if (song.category === 'shaabi' || song.category === 'maghreb') {
    return pickTrackById(song.id, [ARCHIVE_TRACKS.amr_ragein, ARCHIVE_TRACKS.nancy_betghayar, ARCHIVE_TRACKS.khaleeji_majeed]);
  }
  return pickTrackById(song.id, MODERN_POOL);
}

class GlobalRadioPlayerService {
  private audio: HTMLAudioElement | null = null;
  private listeners: Set<(snap: RadioPlayerSnapshot) => void> = new Set();
  private timeListeners: Set<(time: { currentTime: number; duration: number }) => void> = new Set();
  private userPausedManually = false;
  private autoplayAttempted = false;
  private loadingTimer: ReturnType<typeof setTimeout> | null = null;
  private lastTimeEmitAt = 0;

  private state: RadioPlayerSnapshot = {
    activeTab: 'radio',
    activeSong: ARABIC_100_SONGS[0],
    activeStation:
      ARABIC_RADIO_STATIONS.find((s) => s.id === 'radio_quran_cairo') || ARABIC_RADIO_STATIONS[0],
    isPlaying: false,
    isLoading: false,
    currentTime: 0,
    duration: 240,
    volume: 0.75,
    isMuted: false,
    playMode: 'sequential',
    autoplayBlocked: false
  };

  private clearLoadingTimer() {
    if (this.loadingTimer) {
      clearTimeout(this.loadingTimer);
      this.loadingTimer = null;
    }
  }

  private scheduleLoadingIndicator() {
    this.clearLoadingTimer();
    this.loadingTimer = setTimeout(() => {
      if (!this.state.isPlaying && !this.state.autoplayBlocked && !this.userPausedManually) {
        if (!this.state.isLoading) {
          this.state = { ...this.state, isLoading: true };
          this.emit();
        }
      }
    }, 350);
  }

  private ensureAudio() {
    if (typeof window === 'undefined') return null;
    if (!this.audio) {
      const audio = new Audio();
      audio.preload = 'metadata';
      audio.volume = this.state.isMuted ? 0 : this.state.volume;

      audio.onloadedmetadata = () => {
        if (
          this.state.activeTab === 'songs' &&
          audio.duration &&
          !isNaN(audio.duration) &&
          isFinite(audio.duration) &&
          audio.duration > 0
        ) {
          this.state = { ...this.state, duration: audio.duration };
          this.emit();
          this.emitTime();
        }
      };

      audio.onplaying = () => {
        this.clearLoadingTimer();
        const nextDur =
          this.state.activeTab === 'songs' &&
          audio.duration &&
          !isNaN(audio.duration) &&
          isFinite(audio.duration)
            ? audio.duration
            : this.state.duration;
        if (!this.state.isPlaying || this.state.isLoading || this.state.autoplayBlocked || nextDur !== this.state.duration) {
          this.state = { ...this.state, isLoading: false, isPlaying: true, autoplayBlocked: false, duration: nextDur };
          this.emit();
        }
      };
      audio.onwaiting = () => {
        // Silent background buffering: never flash loading spinner during live playback
      };
      audio.onpause = () => {
        this.clearLoadingTimer();
        if (this.state.isPlaying || this.state.isLoading) {
          this.state = { ...this.state, isPlaying: false, isLoading: false };
          this.emit();
        }
      };
      audio.ontimeupdate = () => {
        const dur = audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)
          ? audio.duration
          : this.state.duration;
        this.state.currentTime = audio.currentTime;
        this.state.duration = dur;
        // Only notify time listeners for song progress, throttled to once per second
        if (this.state.activeTab === 'songs' && this.timeListeners.size > 0) {
          const now = Date.now();
          if (now - this.lastTimeEmitAt >= 900) {
            this.lastTimeEmitAt = now;
            this.emitTime();
          }
        }
      };
      audio.onended = () => {
        if (this.state.activeTab === 'songs') {
          this.next();
        }
      };
      audio.onerror = () => {
        this.clearLoadingTimer();
        if (this.state.isLoading || this.state.isPlaying) {
          this.state = { ...this.state, isLoading: false, isPlaying: false };
          this.emit();
        }
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

  private emitTime() {
    const payload = { currentTime: this.state.currentTime, duration: this.state.duration };
    this.timeListeners.forEach((cb) => {
      try {
        cb(payload);
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

  subscribeTime(callback: (time: { currentTime: number; duration: number }) => void): () => void {
    this.timeListeners.add(callback);
    callback({ currentTime: this.state.currentTime, duration: this.state.duration });
    return () => {
      this.timeListeners.delete(callback);
    };
  }

  setTab(tab: RadioPlayerTab) {
    if (this.state.activeTab === tab) return;
    this.state = { ...this.state, activeTab: tab };
    this.emit();
  }

  setPlayMode(mode: RadioPlayMode) {
    if (this.state.playMode === mode) return;
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
    this.state.currentTime = timeSec;
    if (this.audio && isFinite(timeSec)) {
      this.audio.currentTime = timeSec;
    }
    this.emitTime();
  }

  tryAutoPlayFM() {
    if (typeof window === 'undefined' || this.autoplayAttempted || this.userPausedManually) return;
    if (localStorage.getItem('shat_masr_radio_autoplay') === 'off') return;
    this.autoplayAttempted = true;
    const audio = this.ensureAudio();
    if (!audio) return;

    // Silent background autoplay attempt without flashing any loading spinner
    audio.src = this.state.activeStation.streamUrl;
    audio.play()
      .then(() => {
        this.state = { ...this.state, activeTab: 'radio', isPlaying: true, isLoading: false, autoplayBlocked: false };
        this.emit();
      })
      .catch(() => {
        this.state = { ...this.state, activeTab: 'radio', isPlaying: false, isLoading: false, autoplayBlocked: true };
        this.emit();

        // Resume cleanly on first user pointer gesture if browser blocked initial autoplay
        const resumeOnGesture = () => {
          if (!this.userPausedManually && !this.state.isPlaying && localStorage.getItem('shat_masr_radio_autoplay') !== 'off') {
            this.playCurrent(true);
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
      isLoading: false
    };
    this.emit();
    this.emitTime();
    this.scheduleLoadingIndicator();
    if (audio) {
      audio.src = getSongAudioSource(song);
      audio.play()
        .then(() => {
          this.clearLoadingTimer();
          this.state = { ...this.state, isPlaying: true, isLoading: false, autoplayBlocked: false };
          this.emit();
        })
        .catch(() => {
          this.clearLoadingTimer();
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
      isLoading: false
    };
    this.emit();
    this.scheduleLoadingIndicator();
    if (audio) {
      audio.src = station.streamUrl;
      audio.play()
        .then(() => {
          this.clearLoadingTimer();
          this.state = { ...this.state, isPlaying: true, isLoading: false, autoplayBlocked: false };
          this.emit();
        })
        .catch(() => {
          this.clearLoadingTimer();
          this.state = { ...this.state, isLoading: false, autoplayBlocked: true };
          this.emit();
        });
    }
  }

  playCurrent(silent: boolean = false) {
    this.userPausedManually = false;
    localStorage.setItem('shat_masr_radio_autoplay', 'on');
    const audio = this.ensureAudio();
    if (!audio) return;
    const targetUrl =
      this.state.activeTab === 'songs'
        ? getSongAudioSource(this.state.activeSong)
        : this.state.activeStation.streamUrl;
    if (!silent) {
      this.scheduleLoadingIndicator();
    }
    if (audio.src !== targetUrl) {
      audio.src = targetUrl;
    }
    audio.play()
      .then(() => {
        this.clearLoadingTimer();
        this.state = { ...this.state, isPlaying: true, isLoading: false, autoplayBlocked: false };
        this.emit();
      })
      .catch(() => {
        this.clearLoadingTimer();
        this.state = { ...this.state, isLoading: false, isPlaying: false };
        this.emit();
      });
  }

  pause() {
    this.userPausedManually = true;
    this.clearLoadingTimer();
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
