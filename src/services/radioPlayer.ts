import { ARABIC_100_SONGS, ArabicSong, formatAudioDuration } from '../data/arabicSongsData';
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
  errorMessage?: string | null;
  unavailableStationIds: string[];
  unavailableSongIds: string[];
  songDurations: Record<string, number>;
  checkingStations: boolean;
}

class GlobalRadioPlayerService {
  // Single authoritative HTML5 Audio element for the entire application
  private audio: HTMLAudioElement | null = null;
  private listeners: Set<(snap: RadioPlayerSnapshot) => void> = new Set();
  private timeListeners: Set<(time: { currentTime: number; duration: number }) => void> = new Set();
  private userPausedManually = false;
  private autoplayAttempted = false;
  private loadingTimer: ReturnType<typeof setTimeout> | null = null;
  private lastTimeEmitAt = 0;
  private fallbackAttemptedForId: string | null = null;
  private fallbackHopsCount = 0;
  private stationsVerifiedAt = 0;
  private verifyStationsPromise: Promise<void> | null = null;

  private state: RadioPlayerSnapshot = {
    activeTab: 'radio',
    activeSong: ARABIC_100_SONGS[0],
    activeStation:
      ARABIC_RADIO_STATIONS.find((s) => s.id === 'radio_quran_cairo') || ARABIC_RADIO_STATIONS[0],
    isPlaying: false,
    isLoading: false,
    currentTime: 0,
    duration: ARABIC_100_SONGS[0]?.durationSeconds || 0,
    volume: 0.75,
    isMuted: false,
    playMode: 'sequential',
    autoplayBlocked: false,
    errorMessage: null,
    unavailableStationIds: [],
    unavailableSongIds: [],
    songDurations: {},
    checkingStations: false
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

  private markStationUnavailable(stationId: string) {
    if (this.state.unavailableStationIds.includes(stationId)) return;
    this.state = {
      ...this.state,
      unavailableStationIds: [...this.state.unavailableStationIds, stationId]
    };
  }

  private markSongUnavailable(songId: string) {
    if (this.state.unavailableSongIds.includes(songId)) return;
    this.state = {
      ...this.state,
      unavailableSongIds: [...this.state.unavailableSongIds, songId]
    };
  }

  private pickHealthyFallbackStation(excludeId: string, preferredCategory?: string): ArabicRadioStation | null {
    const unavailable = new Set([...this.state.unavailableStationIds, excludeId]);
    const sameCategory = preferredCategory
      ? ARABIC_RADIO_STATIONS.find(
          (s) =>
            s.category === preferredCategory &&
            !unavailable.has(s.id) &&
            Boolean(s.streamUrl && s.streamUrl.startsWith('https://'))
        )
      : undefined;
    if (sameCategory) return sameCategory;
    const anyHealthy = ARABIC_RADIO_STATIONS.find(
      (s) => !unavailable.has(s.id) && Boolean(s.streamUrl && s.streamUrl.startsWith('https://'))
    );
    return anyHealthy || null;
  }

  private applyRealSongDuration(audio: HTMLAudioElement) {
    if (
      this.state.activeTab !== 'songs' ||
      !audio.duration ||
      isNaN(audio.duration) ||
      !isFinite(audio.duration) ||
      audio.duration <= 0
    ) {
      return;
    }
    const realDuration = Math.floor(audio.duration);
    const currentSong = this.state.activeSong;
    const prevMapped = this.state.songDurations[currentSong.id];
    const nextDurations =
      prevMapped !== realDuration
        ? { ...this.state.songDurations, [currentSong.id]: realDuration }
        : this.state.songDurations;

    const updatedSong =
      currentSong.durationSeconds !== realDuration
        ? {
            ...currentSong,
            durationSeconds: realDuration,
            duration: formatAudioDuration(realDuration)
          }
        : currentSong;

    this.state = {
      ...this.state,
      duration: audio.duration,
      activeSong: updatedSong,
      songDurations: nextDurations
    };
    this.emit();
    this.emitTime();
  }

  private ensureAudio(): HTMLAudioElement | null {
    if (typeof window === 'undefined') return null;
    if (!this.audio) {
      const audio = new Audio();
      audio.preload = 'metadata';
      audio.volume = this.state.isMuted ? 0 : this.state.volume;

      audio.onloadedmetadata = () => {
        this.applyRealSongDuration(audio);
      };

      audio.ondurationchange = () => {
        this.applyRealSongDuration(audio);
      };

      audio.onplaying = () => {
        this.clearLoadingTimer();
        if (this.state.activeTab === 'songs') {
          this.applyRealSongDuration(audio);
        }
        const currentId =
          this.state.activeTab === 'radio' ? this.state.activeStation.id : this.state.activeSong.id;
        // Clear stale unavailable flag if playback succeeded
        const nextUnavailableStations =
          this.state.activeTab === 'radio'
            ? this.state.unavailableStationIds.filter((id) => id !== currentId)
            : this.state.unavailableStationIds;
        const nextUnavailableSongs =
          this.state.activeTab === 'songs'
            ? this.state.unavailableSongIds.filter((id) => id !== currentId)
            : this.state.unavailableSongIds;

        this.fallbackHopsCount = 0;
        this.state = {
          ...this.state,
          isLoading: false,
          isPlaying: true,
          autoplayBlocked: false,
          errorMessage: null,
          unavailableStationIds: nextUnavailableStations,
          unavailableSongIds: nextUnavailableSongs
        };
        this.emit();
      };

      audio.onwaiting = () => {
        // Silent background buffering
      };

      audio.onpause = () => {
        this.clearLoadingTimer();
        if (this.state.isPlaying || this.state.isLoading) {
          this.state = { ...this.state, isPlaying: false, isLoading: false };
          this.emit();
        }
      };

      audio.ontimeupdate = () => {
        const dur =
          this.state.activeTab === 'songs' &&
          audio.duration &&
          !isNaN(audio.duration) &&
          isFinite(audio.duration) &&
          audio.duration > 0
            ? audio.duration
            : this.state.duration;
        this.state.currentTime = audio.currentTime;
        this.state.duration = dur;
        if (this.state.activeTab === 'songs' && this.timeListeners.size > 0) {
          const now = Date.now();
          if (now - this.lastTimeEmitAt >= 750) {
            this.lastTimeEmitAt = now;
            this.emitTime();
          }
        }
      };

      audio.onended = () => {
        if (this.state.activeTab === 'songs') {
          this.playNextInSameCategory(true);
        }
      };

      audio.onerror = () => {
        this.clearLoadingTimer();
        if (this.state.activeTab === 'radio') {
          const station = this.state.activeStation;
          // 1. Try fallbackUrl for the same station first
          if (
            station.fallbackUrl &&
            station.fallbackUrl.startsWith('https://') &&
            this.fallbackAttemptedForId !== station.id &&
            !this.userPausedManually
          ) {
            this.fallbackAttemptedForId = station.id;
            this.state = {
              ...this.state,
              isLoading: true,
              errorMessage: 'جارٍ تجربة البث البديل للقناة...'
            };
            this.emit();
            audio.src = station.fallbackUrl;
            audio.play().catch(() => {
              this.tryAutoSwitchToHealthyStation(station);
            });
            return;
          }

          // 2. Automatically fall back to another live station (up to 4 hops) so radio keeps playing cleanly
          this.tryAutoSwitchToHealthyStation(station);
          return;
        }

        // Music track failed: mark THIS song unavailable, never substitute a different wrong track
        const song = this.state.activeSong;
        this.markSongUnavailable(song.id);
        this.state = {
          ...this.state,
          isLoading: false,
          isPlaying: false,
          errorMessage: 'تعذر تشغيل الأغنية — غير متاحة'
        };
        this.emit();
      };

      this.audio = audio;
    }
    return this.audio;
  }

  private tryAutoSwitchToHealthyStation(failedStation: ArabicRadioStation) {
    this.markStationUnavailable(failedStation.id);
    if (!this.userPausedManually && this.fallbackHopsCount < 4) {
      const alt = this.pickHealthyFallbackStation(failedStation.id, failedStation.category);
      if (alt) {
        this.fallbackHopsCount += 1;
        this.fallbackAttemptedForId = null;
        const audio = this.ensureAudio();
        this.state = {
          ...this.state,
          activeTab: 'radio',
          activeStation: alt,
          isLoading: true,
          errorMessage: `تم التحويل تلقائياً إلى ${alt.name}`
        };
        this.emit();
        if (audio) {
          audio.src = alt.streamUrl;
          audio.play().catch(() => {
            this.clearLoadingTimer();
            this.state = { ...this.state, isLoading: false, isPlaying: false, errorMessage: null };
            this.emit();
          });
          return;
        }
      }
    }
    this.state = {
      ...this.state,
      isLoading: false,
      isPlaying: false,
      errorMessage: 'تعذر تشغيل القناة — جرّب محطة أخرى'
    };
    this.emit();
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

  async verifyAllStations(force: boolean = false): Promise<void> {
    if (typeof window === 'undefined') return;
    const now = Date.now();
    if (!force && this.stationsVerifiedAt > 0 && now - this.stationsVerifiedAt < 120000) {
      return;
    }
    if (this.verifyStationsPromise) return this.verifyStationsPromise;

    this.state = { ...this.state, checkingStations: true };
    this.emit();

    this.verifyStationsPromise = (async () => {
      try {
        const res = await fetch('/api/radio/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            stations: ARABIC_RADIO_STATIONS.map((s) => ({
              id: s.id,
              streamUrl: s.streamUrl,
              fallbackUrl: s.fallbackUrl
            }))
          })
        });
        if (res.ok) {
          const data = await res.json();
          const availability = (data?.availability || {}) as Record<string, boolean>;
          const deadIds = Object.entries(availability)
            .filter(([, isUp]) => isUp === false)
            .map(([id]) => id);
          this.stationsVerifiedAt = Date.now();
          let nextActive = this.state.activeStation;
          if (!this.state.isPlaying && deadIds.includes(nextActive.id)) {
            const healthy = ARABIC_RADIO_STATIONS.find((s) => !deadIds.includes(s.id));
            if (healthy) nextActive = healthy;
          }
          this.state = {
            ...this.state,
            activeStation: nextActive,
            unavailableStationIds: deadIds,
            checkingStations: false
          };
          this.emit();
          return;
        }
      } catch {
        // Keep current availability on network hiccup
      } finally {
        this.verifyStationsPromise = null;
      }
      this.state = { ...this.state, checkingStations: false };
      this.emit();
    })();

    return this.verifyStationsPromise;
  }

  setTab(tab: RadioPlayerTab) {
    if (this.state.activeTab === tab) return;
    this.state = { ...this.state, activeTab: tab, errorMessage: null };
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
    if (this.audio && isFinite(timeSec) && timeSec >= 0) {
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

    this.verifyAllStations(false);

    const st = this.state.activeStation;
    if (!st.streamUrl || !st.streamUrl.startsWith('https://')) return;

    this.fallbackAttemptedForId = null;
    audio.src = st.streamUrl;
    audio.play()
      .then(() => {
        this.state = {
          ...this.state,
          activeTab: 'radio',
          isPlaying: true,
          isLoading: false,
          autoplayBlocked: false,
          errorMessage: null
        };
        this.emit();
      })
      .catch(() => {
        this.state = {
          ...this.state,
          activeTab: 'radio',
          isPlaying: false,
          isLoading: false,
          autoplayBlocked: true
        };
        this.emit();

        const resumeOnGesture = () => {
          if (
            !this.userPausedManually &&
            !this.state.isPlaying &&
            localStorage.getItem('shat_masr_radio_autoplay') !== 'off'
          ) {
            this.playCurrent(true);
          }
          window.removeEventListener('pointerdown', resumeOnGesture);
        };
        window.addEventListener('pointerdown', resumeOnGesture, { once: true });
      });
  }

  selectSong(song: ArabicSong) {
    if (this.state.unavailableSongIds.includes(song.id) || !song.audioUrl || !song.audioUrl.startsWith('https://')) {
      this.state = {
        ...this.state,
        activeTab: 'songs',
        activeSong: song,
        isPlaying: false,
        isLoading: false,
        errorMessage: 'هذه الأغنية غير متاحة حالياً'
      };
      this.emit();
      return;
    }

    this.userPausedManually = false;
    const audio = this.ensureAudio();
    const mappedDur = this.state.songDurations[song.id] || song.durationSeconds || 0;
    this.state = {
      ...this.state,
      activeTab: 'songs',
      activeSong: {
        ...song,
        durationSeconds: mappedDur,
        duration: mappedDur > 0 ? formatAudioDuration(mappedDur) : song.duration
      },
      currentTime: 0,
      duration: mappedDur,
      isLoading: false,
      errorMessage: null
    };
    this.emit();
    this.emitTime();
    this.scheduleLoadingIndicator();

    if (audio) {
      audio.src = song.audioUrl;
      audio.play()
        .then(() => {
          this.clearLoadingTimer();
          this.applyRealSongDuration(audio);
          this.state = {
            ...this.state,
            isPlaying: true,
            isLoading: false,
            autoplayBlocked: false,
            errorMessage: null
          };
          this.emit();
        })
        .catch(() => {
          this.clearLoadingTimer();
          this.state = {
            ...this.state,
            isLoading: false,
            isPlaying: false,
            autoplayBlocked: true
          };
          this.emit();
        });
    }
  }

  selectStation(station: ArabicRadioStation) {
    this.userPausedManually = false;
    this.fallbackAttemptedForId = null;
    this.fallbackHopsCount = 0;

    let targetStation = station;
    if (
      this.state.unavailableStationIds.includes(station.id) ||
      !station.streamUrl ||
      !station.streamUrl.startsWith('https://')
    ) {
      const alt = this.pickHealthyFallbackStation(station.id, station.category);
      if (!alt) {
        this.state = {
          ...this.state,
          activeTab: 'radio',
          activeStation: station,
          isPlaying: false,
          isLoading: false,
          errorMessage: 'غير متاحة — تعذر تشغيل القناة'
        };
        this.emit();
        return;
      }
      targetStation = alt;
    }

    const audio = this.ensureAudio();
    this.state = {
      ...this.state,
      activeTab: 'radio',
      activeStation: targetStation,
      isLoading: false,
      errorMessage: null
    };
    this.emit();
    this.scheduleLoadingIndicator();

    if (audio) {
      audio.src = targetStation.streamUrl;
      audio.play()
        .then(() => {
          this.clearLoadingTimer();
          this.state = {
            ...this.state,
            isPlaying: true,
            isLoading: false,
            autoplayBlocked: false,
            errorMessage: null
          };
          this.emit();
        })
        .catch(() => {
          this.clearLoadingTimer();
          this.state = {
            ...this.state,
            isLoading: false,
            isPlaying: false,
            autoplayBlocked: true
          };
          this.emit();
        });
    }
  }

  playCurrent(silent: boolean = false) {
    this.userPausedManually = false;
    localStorage.setItem('shat_masr_radio_autoplay', 'on');
    const audio = this.ensureAudio();
    if (!audio) return;

    if (this.state.activeTab === 'songs') {
      const song = this.state.activeSong;
      if (
        this.state.unavailableSongIds.includes(song.id) ||
        !song.audioUrl ||
        !song.audioUrl.startsWith('https://')
      ) {
        this.state = {
          ...this.state,
          isPlaying: false,
          isLoading: false,
          errorMessage: 'هذه الأغنية غير متاحة حالياً'
        };
        this.emit();
        return;
      }
      if (!silent) this.scheduleLoadingIndicator();
      if (audio.src !== song.audioUrl) {
        audio.src = song.audioUrl;
      }
      audio.play()
        .then(() => {
          this.clearLoadingTimer();
          this.applyRealSongDuration(audio);
          this.state = {
            ...this.state,
            isPlaying: true,
            isLoading: false,
            autoplayBlocked: false,
            errorMessage: null
          };
          this.emit();
        })
        .catch(() => {
          this.clearLoadingTimer();
          this.state = { ...this.state, isLoading: false, isPlaying: false };
          this.emit();
        });
      return;
    }

    let station = this.state.activeStation;
    if (
      this.state.unavailableStationIds.includes(station.id) ||
      !station.streamUrl ||
      !station.streamUrl.startsWith('https://')
    ) {
      const alt = this.pickHealthyFallbackStation(station.id, station.category);
      if (!alt) {
        this.state = {
          ...this.state,
          isPlaying: false,
          isLoading: false,
          errorMessage: 'تعذر تشغيل القناة'
        };
        this.emit();
        return;
      }
      station = alt;
      this.state = { ...this.state, activeStation: station };
    }

    this.fallbackAttemptedForId = null;
    this.fallbackHopsCount = 0;
    if (!silent) this.scheduleLoadingIndicator();
    if (audio.src !== station.streamUrl && audio.src !== station.fallbackUrl) {
      audio.src = station.streamUrl;
    }
    audio.play()
      .then(() => {
        this.clearLoadingTimer();
        this.state = {
          ...this.state,
          isPlaying: true,
          isLoading: false,
          autoplayBlocked: false,
          errorMessage: null
        };
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

  pauseForCall() {
    this.clearLoadingTimer();
    if (this.audio && !this.audio.paused) {
      this.audio.pause();
    }
    if (this.state.isPlaying || this.state.isLoading) {
      this.state = { ...this.state, isPlaying: false, isLoading: false };
      this.emit();
    }
  }

  stop() {
    this.clearLoadingTimer();
    if (this.audio && !this.audio.paused) {
      this.audio.pause();
    }
    if (this.state.isPlaying || this.state.isLoading || this.state.autoplayBlocked) {
      this.state = { ...this.state, isPlaying: false, isLoading: false, autoplayBlocked: false };
      this.emit();
    }
  }

  togglePlay() {
    this.state = { ...this.state, errorMessage: null };
    if (this.state.isPlaying) {
      this.pause();
    } else {
      this.playCurrent();
    }
  }

  private playNextInSameCategory(fromAutoEnd: boolean) {
    const current = this.state.activeSong;
    if (fromAutoEnd && this.state.playMode === 'repeat_one') {
      this.selectSong(current);
      return;
    }

    const unavailable = new Set(this.state.unavailableSongIds);
    const sameCat = ARABIC_100_SONGS.filter(
      (s) => s.category === current.category && !unavailable.has(s.id)
    );
    const pool =
      sameCat.length > 0
        ? sameCat
        : ARABIC_100_SONGS.filter((s) => !unavailable.has(s.id));

    if (pool.length === 0) return;

    if (this.state.playMode === 'shuffle') {
      const others = pool.filter((s) => s.id !== current.id);
      const pickList = others.length > 0 ? others : pool;
      const randomSong = pickList[Math.floor(Math.random() * pickList.length)];
      this.selectSong(randomSong);
      return;
    }

    const idx = pool.findIndex((s) => s.id === current.id);
    const nextSong = pool[(idx + 1) % pool.length];
    this.selectSong(nextSong);
  }

  next() {
    if (this.state.activeTab === 'radio') {
      const unavailable = new Set(this.state.unavailableStationIds);
      const available = ARABIC_RADIO_STATIONS.filter((s) => !unavailable.has(s.id));
      const pool = available.length > 0 ? available : ARABIC_RADIO_STATIONS;
      const idx = pool.findIndex((s) => s.id === this.state.activeStation.id);
      const nextStation = pool[(idx + 1) % pool.length];
      this.selectStation(nextStation);
      return;
    }
    this.playNextInSameCategory(false);
  }

  prev() {
    if (this.state.activeTab === 'radio') {
      const unavailable = new Set(this.state.unavailableStationIds);
      const available = ARABIC_RADIO_STATIONS.filter((s) => !unavailable.has(s.id));
      const pool = available.length > 0 ? available : ARABIC_RADIO_STATIONS;
      const idx = pool.findIndex((s) => s.id === this.state.activeStation.id);
      const prevStation = pool[(idx - 1 + pool.length) % pool.length];
      this.selectStation(prevStation);
      return;
    }

    const current = this.state.activeSong;
    const unavailable = new Set(this.state.unavailableSongIds);
    const sameCat = ARABIC_100_SONGS.filter(
      (s) => s.category === current.category && !unavailable.has(s.id)
    );
    const pool =
      sameCat.length > 0
        ? sameCat
        : ARABIC_100_SONGS.filter((s) => !unavailable.has(s.id));
    if (pool.length === 0) return;

    if (this.state.playMode === 'shuffle') {
      const others = pool.filter((s) => s.id !== current.id);
      const pickList = others.length > 0 ? others : pool;
      const randomSong = pickList[Math.floor(Math.random() * pickList.length)];
      this.selectSong(randomSong);
      return;
    }

    const idx = pool.findIndex((s) => s.id === current.id);
    const prevSong = pool[(idx - 1 + pool.length) % pool.length];
    this.selectSong(prevSong);
  }
}

export const globalRadioPlayer = new GlobalRadioPlayerService();
