import musicLibraryRaw from './musicLibrary.json';

export type SongCategory = 'tarab' | 'classic' | 'levantine' | 'modern' | 'khaleeji' | 'maghreb';

export interface MusicLibraryItem {
  id: string;
  title: string;
  artist: string;
  category: SongCategory;
  coverImage: string;
  audioUrl: string;
  durationSeconds: number;
}

export interface ArabicSong extends MusicLibraryItem {
  categoryLabel: string;
  duration: string;
}

export const SONG_CATEGORY_LABELS: Record<SongCategory, string> = {
  tarab: 'طرب أصيل',
  classic: 'كلاسيك مصري',
  levantine: 'فيروز وشامي',
  modern: 'معاصر وهضبة',
  khaleeji: 'روائع الخليج',
  maghreb: 'مغربي وراي',
};

export function formatAudioDuration(seconds: number): string {
  if (!seconds || isNaN(seconds) || !isFinite(seconds) || seconds <= 0) {
    return '0:00';
  }
  const total = Math.floor(seconds);
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hrs > 0) {
    return `${hrs}:${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

const rawList = musicLibraryRaw as MusicLibraryItem[];

export const ARABIC_100_SONGS: ArabicSong[] = rawList.map((item) => ({
  ...item,
  categoryLabel: SONG_CATEGORY_LABELS[item.category] || 'موسيقى عربية',
  duration: formatAudioDuration(item.durationSeconds),
}));
