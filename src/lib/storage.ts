export type Grade = 1 | 2 | 3 | 4 | 5;

export interface Song {
  id: string;
  title: string;
  theme: string;
  grade: Grade | 'Tất cả';
  lyrics: string;
  audioId: string;
  coverId?: string;
}

export interface LearningGame {
  id: string;
  title: string;
  description: string;
  grade: Grade;
  url: string;
}

const DB_NAME = 'the-gioi-mi-thuat-preview';
const DB_VERSION = 1;
const STORE_NAME = 'media';
const SONGS_KEY = 'tgmt-songs-v1';
const GAMES_KEY = 'tgmt-games-v1';
const ACHIEVEMENTS_KEY = 'tgmt-achievements-v1';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Không mở được kho lưu trữ trên trình duyệt.'));
  });
}

export async function putMedia(id: string, file: Blob): Promise<void> {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(file, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Không lưu được tệp.'));
  });
  db.close();
}

export async function getMedia(id: string): Promise<Blob | undefined> {
  const db = await openDatabase();
  const result = await new Promise<Blob | undefined>((resolve, reject) => {
    const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(id);
    request.onsuccess = () => resolve(request.result as Blob | undefined);
    request.onerror = () => reject(request.error ?? new Error('Không đọc được tệp.'));
  });
  db.close();
  return result;
}

export async function removeMedia(id: string): Promise<void> {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Không xóa được tệp.'));
  });
  db.close();
}

function readList<T>(key: string): T[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? '[]');
    return Array.isArray(value) ? (value as T[]) : [];
  } catch {
    return [];
  }
}

function writeList<T>(key: string, value: T[]): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export const getSongs = (): Song[] => readList<Song>(SONGS_KEY);
export const saveSongs = (songs: Song[]): void => writeList(SONGS_KEY, songs);
export const getGames = (): LearningGame[] => readList<LearningGame>(GAMES_KEY);
export const saveGames = (games: LearningGame[]): void => writeList(GAMES_KEY, games);

export interface Progress {
  points: number;
  completed: string[];
  badges: string[];
}

export const defaultProgress: Progress = { points: 0, completed: [], badges: [] };

export function getProgress(): Progress {
  try {
    const value = JSON.parse(localStorage.getItem(ACHIEVEMENTS_KEY) ?? 'null') as Progress | null;
    if (value && typeof value.points === 'number' && Array.isArray(value.completed) && Array.isArray(value.badges)) return value;
  } catch {
    // Return a fresh anonymous progress record when browser storage is unavailable/corrupt.
  }
  return { ...defaultProgress, completed: [], badges: [] };
}

export function saveProgress(progress: Progress): void {
  localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(progress));
}
