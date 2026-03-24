'use client';

import { create } from 'zustand';

interface UIState {
  // Panel Visibility
  showOptionChain: boolean;
  showOrderPanel: boolean;
  showPositions: boolean;
  showTradeHistory: boolean;

  // Settings
  soundEnabled: boolean;
  showIndicators: boolean;

  // Notifications
  notifications: Notification[];

  // Actions
  toggleOptionChain: () => void;
  toggleOrderPanel: () => void;
  togglePositions: () => void;
  toggleTradeHistory: () => void;
  toggleSound: () => void;
  toggleIndicators: () => void;
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
}

interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: number;
}

export const useUIStore = create<UIState>((set) => ({
  // Default panel visibility
  showOptionChain: true,
  showOrderPanel: true,
  showPositions: true,
  showTradeHistory: false,

  soundEnabled: true,
  showIndicators: true,

  notifications: [],

  toggleOptionChain: () =>
    set((state) => ({ showOptionChain: !state.showOptionChain })),
  toggleOrderPanel: () =>
    set((state) => ({ showOrderPanel: !state.showOrderPanel })),
  togglePositions: () =>
    set((state) => ({ showPositions: !state.showPositions })),
  toggleTradeHistory: () =>
    set((state) => ({ showTradeHistory: !state.showTradeHistory })),
  toggleSound: () =>
    set((state) => ({ soundEnabled: !state.soundEnabled })),
  toggleIndicators: () =>
    set((state) => ({ showIndicators: !state.showIndicators })),

  addNotification: (notification) =>
    set((state) => ({
      notifications: [
        ...state.notifications,
        {
          ...notification,
          id: crypto.randomUUID(),
          timestamp: Date.now(),
        },
      ],
    })),

  removeNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    })),

  clearNotifications: () => set({ notifications: [] }),
}));
