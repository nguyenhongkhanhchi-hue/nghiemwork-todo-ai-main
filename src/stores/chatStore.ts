import { create } from 'zustand';
import type { ChatMessage, ChatChannel } from '@/types';
import { loadFromStorage, saveToStorage, getUserKey } from '@/lib/storage';

interface ChatStore {
  messages: ChatMessage[];
  channels: ChatChannel[];
  _userId: string | undefined;
  initForUser: (userId?: string) => void;
  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  clearMessages: () => void;
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

export const useChatStore = create<ChatStore>((set, get) => ({
  messages: [],
  channels: [],
  _userId: undefined,

  initForUser: (userId = 'admin') => {
    set({ _userId: userId });
    const key = getUserKey('nw_chat', userId);
    const saved = loadFromStorage<ChatMessage[]>(key, []);
    set({ messages: saved });
  },

  addMessage: (message) => {
    const userId = get()._userId;
    const newMessage: ChatMessage = {
      ...message,
      id: generateId(),
      timestamp: Date.now(),
    };
    const updated = [...get().messages, newMessage];
    saveToStorage(getUserKey('nw_chat', userId), updated);
    set({ messages: updated });
  },

  clearMessages: () => {
    const userId = get()._userId;
    saveToStorage(getUserKey('nw_chat', userId), []);
    set({ messages: [] });
  },
}));
