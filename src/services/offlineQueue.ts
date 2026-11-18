import { Message } from '../types/chat';

export interface OfflineQueuedItem {
  id: string;
  targetType: 'room' | 'dm';
  targetId: string; // roomId or convId
  recipientId?: string;
  recipientSessionId?: string;
  message: Message;
  queuedAt: number;
}

const OFFLINE_QUEUE_KEY = 'shat_masr_offline_queue_v1';

class OfflineQueueManager {
  private listeners = new Set<(queue: OfflineQueuedItem[]) => void>();
  private isFlushing = false;
  private flushHandler: ((item: OfflineQueuedItem) => Promise<void>) | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.flushAll();
      });
    }
  }

  readQueue(): OfflineQueuedItem[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private writeQueue(queue: OfflineQueuedItem[]) {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue.slice(-100)));
    } catch {}
    this.notify();
  }

  private notify() {
    const q = this.readQueue();
    this.listeners.forEach((cb) => cb(q));
  }

  subscribe(cb: (queue: OfflineQueuedItem[]) => void): () => void {
    this.listeners.add(cb);
    cb(this.readQueue());
    return () => {
      this.listeners.delete(cb);
    };
  }

  setFlushHandler(handler: (item: OfflineQueuedItem) => Promise<void>) {
    this.flushHandler = handler;
    if (typeof navigator !== 'undefined' && navigator.onLine !== false) {
      this.flushAll();
    }
  }

  enqueue(item: OfflineQueuedItem) {
    const current = this.readQueue();
    if (!current.some((q) => q.id === item.id)) {
      current.push(item);
      this.writeQueue(current);
    }
  }

  remove(id: string) {
    const next = this.readQueue().filter((q) => q.id !== id);
    this.writeQueue(next);
  }

  async flushAll(): Promise<void> {
    if (this.isFlushing || !this.flushHandler) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;

    const current = this.readQueue();
    if (current.length === 0) return;

    this.isFlushing = true;
    try {
      for (const item of current) {
        if (typeof navigator !== 'undefined' && navigator.onLine === false) break;
        try {
          await this.flushHandler(item);
          this.remove(item.id);
        } catch {
          // Stop flushing further until connectivity stabilizes
          break;
        }
      }
    } finally {
      this.isFlushing = false;
    }
  }
}

export const offlineQueue = new OfflineQueueManager();
