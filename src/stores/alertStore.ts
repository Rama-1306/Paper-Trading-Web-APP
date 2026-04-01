'use client';

import { create } from 'zustand';
import type { Tick } from '@/types/market';
import { useUIStore } from '@/stores/uiStore';

export type LtpCondition = 'ABOVE' | 'BELOW';
export type AlertKind = 'POSITION_FILLED' | 'TARGET_HIT' | 'SL_TRIGGER' | 'LTP_TRIGGER';
export type RepeatDuration = 0 | 30 | 60;

export interface EventAlertSettings {
  positionFilled: boolean;
  targetHit: boolean;
  slTrigger: boolean;
}

export interface LtpAlert {
  id: string;
  symbol: string;
  displayName: string;
  condition: LtpCondition;
  targetPrice: number;
  isEnabled: boolean;
  isTriggered: boolean;
  createdAt: number;
  triggeredAt?: number;
}

export interface AlertHistoryItem {
  id: string;
  kind: AlertKind;
  title: string;
  message: string;
  symbol?: string;
  price?: number;
  timestamp: number;
  referenceId?: string;
}

export interface CustomAlertSound {
  name: string;
  mimeType: string;
  durationSeconds: number;
  objectUrl: string;
}

export type AlertRepeatDurations = Record<AlertKind, RepeatDuration>;
export type AlertCustomSoundMap = Partial<Record<AlertKind, CustomAlertSound>>;

interface PersistedAlertState {
  eventSettings: EventAlertSettings;
  ltpAlerts: LtpAlert[];
  alertHistory: AlertHistoryItem[];
  repeatDurations: AlertRepeatDurations;
  desktopOnlyMode: boolean;
}

interface AlertState {
  eventSettings: EventAlertSettings;
  ltpAlerts: LtpAlert[];
  alertHistory: AlertHistoryItem[];
  repeatDurations: AlertRepeatDurations;
  customSounds: AlertCustomSoundMap;
  desktopOnlyMode: boolean;
  notificationPermission: NotificationPermission | 'unsupported';
  setEventAlertEnabled: (key: keyof EventAlertSettings, enabled: boolean) => void;
  addLtpAlert: (input: {
    symbol: string;
    displayName: string;
    condition: LtpCondition;
    targetPrice: number;
  }) => { ok: boolean; error?: string; id?: string };
  toggleLtpAlertEnabled: (id: string) => void;
  resetLtpAlert: (id: string) => void;
  removeLtpAlert: (id: string) => void;
  getActiveAlertSymbols: () => string[];
  handleOrderFilled: (data: any) => boolean;
  handlePositionClosed: (data: any) => boolean;
  processTicks: (ticks: Tick[]) => void;
  setRepeatDuration: (kind: AlertKind, duration: RepeatDuration) => void;
  setCustomSoundForKind: (kind: AlertKind, sound: CustomAlertSound | null) => void;
  playAlertSound: (kind?: AlertKind) => void;
  setDesktopOnlyMode: (enabled: boolean) => void;
  requestDesktopPermission: () => Promise<NotificationPermission | 'unsupported'>;
  syncNotificationPermission: () => void;
  clearAlertHistory: () => void;
}

const ALERT_STORAGE_KEY = 'paper-trader-alerts-v2';

const defaultEventSettings: EventAlertSettings = {
  positionFilled: true,
  targetHit: true,
  slTrigger: true,
};

const defaultRepeatDurations: AlertRepeatDurations = {
  POSITION_FILLED: 0,
  TARGET_HIT: 0,
  SL_TRIGGER: 0,
  LTP_TRIGGER: 0,
};

const defaultPersistedState: PersistedAlertState = {
  eventSettings: defaultEventSettings,
  ltpAlerts: [],
  alertHistory: [],
  repeatDurations: defaultRepeatDurations,
  desktopOnlyMode: false,
};

function normalizeRepeatDuration(input: unknown): RepeatDuration {
  return input === 30 || input === 60 ? input : 0;
}

function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined') return 'unsupported';
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

function loadPersistedState(): PersistedAlertState {
  if (typeof window === 'undefined') return defaultPersistedState;

  try {
    const raw = localStorage.getItem(ALERT_STORAGE_KEY);
    if (!raw) return defaultPersistedState;

    const parsed = JSON.parse(raw) as Partial<PersistedAlertState>;
    const parsedRepeat = (parsed.repeatDurations || {}) as Partial<Record<AlertKind, unknown>>;

    return {
      eventSettings: {
        ...defaultEventSettings,
        ...(parsed.eventSettings || {}),
      },
      ltpAlerts: Array.isArray(parsed.ltpAlerts) ? parsed.ltpAlerts : [],
      alertHistory: Array.isArray(parsed.alertHistory) ? parsed.alertHistory.slice(0, 200) : [],
      repeatDurations: {
        POSITION_FILLED: normalizeRepeatDuration(parsedRepeat.POSITION_FILLED),
        TARGET_HIT: normalizeRepeatDuration(parsedRepeat.TARGET_HIT),
        SL_TRIGGER: normalizeRepeatDuration(parsedRepeat.SL_TRIGGER),
        LTP_TRIGGER: normalizeRepeatDuration(parsedRepeat.LTP_TRIGGER),
      },
      desktopOnlyMode: Boolean(parsed.desktopOnlyMode),
    };
  } catch {
    return defaultPersistedState;
  }
}

function persistState(state: Pick<AlertState, 'eventSettings' | 'ltpAlerts' | 'alertHistory' | 'repeatDurations' | 'desktopOnlyMode'>) {
  if (typeof window === 'undefined') return;
  try {
    const payload: PersistedAlertState = {
      eventSettings: state.eventSettings,
      ltpAlerts: state.ltpAlerts,
      alertHistory: state.alertHistory.slice(0, 200),
      repeatDurations: state.repeatDurations,
      desktopOnlyMode: state.desktopOnlyMode,
    };
    localStorage.setItem(ALERT_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // ignore persistence errors
  }
}
let sharedAudioContext: AudioContext | null = null;
let audioUnlockListenerRegistered = false;

function getSharedAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;

  const AudioContextCtor =
    window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!AudioContextCtor) return null;
  if (!sharedAudioContext) {
    sharedAudioContext = new AudioContextCtor();
  }

  return sharedAudioContext;
}

function ensureAudioUnlockListener() {
  if (typeof window === 'undefined' || audioUnlockListenerRegistered) return;

  const unlock = () => {
    const ctx = getSharedAudioContext();
    if (!ctx || ctx.state === 'running') return;
    void ctx.resume().catch(() => undefined);
  };

  window.addEventListener('pointerdown', unlock, true);
  window.addEventListener('touchstart', unlock, true);
  window.addEventListener('keydown', unlock, true);
  audioUnlockListenerRegistered = true;
}

function playFallbackBeep() {
  if (typeof window === 'undefined') return;
  ensureAudioUnlockListener();

  try {
    const ctx = getSharedAudioContext();
    if (!ctx) return;

    const play = () => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);

      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.35);
    };

    if (ctx.state === 'suspended') {
      ctx.resume().then(play).catch(() => undefined);
      return;
    }

    play();
  } catch {
    // ignore audio errors
  }
}

function playFallbackBeepWithRepeat(duration: RepeatDuration) {
  playFallbackBeep();
  if (duration === 0 || typeof window === 'undefined') return;

  const endAt = Date.now() + duration * 1000;
  const intervalId = window.setInterval(() => {
    playFallbackBeep();
    if (Date.now() >= endAt) {
      window.clearInterval(intervalId);
    }
  }, 1000);
}

function showDesktopNotification(title: string, message: string): boolean {
  if (typeof window === 'undefined') return false;
  if (!('Notification' in window)) return false;
  if (Notification.permission !== 'granted') return false;

  try {
    new Notification(title, { body: message, silent: true });
    return true;
  } catch {
    return false;
  }
}

const initialPersisted = loadPersistedState();
if (typeof window !== 'undefined') {
  ensureAudioUnlockListener();
}

export const useAlertStore = create<AlertState>((set, get) => {
  const playConfiguredSound = (kind: AlertKind) => {
    ensureAudioUnlockListener();
    const state = get();
    const repeatDuration = state.repeatDurations[kind];
    const configuredSound = state.customSounds[kind];

    if (!configuredSound?.objectUrl) {
      playFallbackBeepWithRepeat(repeatDuration);
      return;
    }

    const audio = new Audio(configuredSound.objectUrl);
    if (repeatDuration > 0) {
      audio.loop = true;
      audio.play().catch(() => playFallbackBeepWithRepeat(repeatDuration));
      window.setTimeout(() => {
        audio.pause();
        audio.currentTime = 0;
      }, repeatDuration * 1000);
      return;
    }

    audio.play().catch(() => playFallbackBeep());
  };

  const emitAlert = (input: {
    kind: AlertKind;
    title: string;
    message: string;
    symbol?: string;
    price?: number;
    referenceId?: string;
    notificationType?: 'success' | 'error' | 'warning' | 'info';
  }): boolean => {
    const existing = get().alertHistory;
    if (input.referenceId && existing.some((item) => item.referenceId === input.referenceId)) {
      return false;
    }

    const item: AlertHistoryItem = {
      id: crypto.randomUUID(),
      kind: input.kind,
      title: input.title,
      message: input.message,
      symbol: input.symbol,
      price: input.price,
      timestamp: Date.now(),
      referenceId: input.referenceId,
    };

    set((state) => ({
      alertHistory: [item, ...state.alertHistory].slice(0, 200),
    }));
    persistState(get());

    const state = get();
    const notificationType = input.notificationType || 'info';
    const desktopShown = showDesktopNotification(input.title, input.message);

    if (!state.desktopOnlyMode || !desktopShown) {
      useUIStore.getState().addNotification({
        type: notificationType,
        title: input.title,
        message: input.message,
      });
    }

    if (useUIStore.getState().soundEnabled && (!state.desktopOnlyMode || !desktopShown)) {
      playConfiguredSound(input.kind);
    }

    return true;
  };

  return {
    eventSettings: initialPersisted.eventSettings,
    ltpAlerts: initialPersisted.ltpAlerts,
    alertHistory: initialPersisted.alertHistory,
    repeatDurations: initialPersisted.repeatDurations,
    customSounds: {},
    desktopOnlyMode: initialPersisted.desktopOnlyMode,
    notificationPermission: getNotificationPermission(),

    setEventAlertEnabled: (key, enabled) => {
      set((state) => ({
        eventSettings: { ...state.eventSettings, [key]: enabled },
      }));
      persistState(get());
    },

    addLtpAlert: ({ symbol, displayName, condition, targetPrice }) => {
      if (!symbol.trim()) {
        return { ok: false, error: 'Symbol is required' };
      }
      if (!Number.isFinite(targetPrice) || targetPrice <= 0) {
        return { ok: false, error: 'Target price must be greater than 0' };
      }

      const normalizedSymbol = symbol.trim().toUpperCase();
      const duplicate = get().ltpAlerts.some(
        (alert) =>
          alert.symbol === normalizedSymbol &&
          alert.condition === condition &&
          Math.abs(alert.targetPrice - targetPrice) < 0.0001
      );

      if (duplicate) {
        return { ok: false, error: 'Same LTP alert already exists' };
      }

      const newAlert: LtpAlert = {
        id: crypto.randomUUID(),
        symbol: normalizedSymbol,
        displayName: displayName || normalizedSymbol,
        condition,
        targetPrice,
        isEnabled: true,
        isTriggered: false,
        createdAt: Date.now(),
      };

      set((state) => ({ ltpAlerts: [newAlert, ...state.ltpAlerts] }));
      persistState(get());
      return { ok: true, id: newAlert.id };
    },

    toggleLtpAlertEnabled: (id) => {
      set((state) => ({
        ltpAlerts: state.ltpAlerts.map((alert) =>
          alert.id === id ? { ...alert, isEnabled: !alert.isEnabled } : alert
        ),
      }));
      persistState(get());
    },

    resetLtpAlert: (id) => {
      set((state) => ({
        ltpAlerts: state.ltpAlerts.map((alert) =>
          alert.id === id
            ? { ...alert, isTriggered: false, triggeredAt: undefined }
            : alert
        ),
      }));
      persistState(get());
    },

    removeLtpAlert: (id) => {
      set((state) => ({
        ltpAlerts: state.ltpAlerts.filter((alert) => alert.id !== id),
      }));
      persistState(get());
    },

    getActiveAlertSymbols: () => {
      const symbols = get()
        .ltpAlerts.filter((a) => a.isEnabled && !a.isTriggered)
        .map((a) => a.symbol);
      return [...new Set(symbols)];
    },

    handleOrderFilled: (data) => {
      if (!get().eventSettings.positionFilled) return false;
      const fillPrice = Number(data.fillPrice || 0);
      return emitAlert({
        kind: 'POSITION_FILLED',
        title: 'Position Filled',
        message: `${data.displayName} ${data.side} ${data.orderType} filled @ ${fillPrice.toFixed(2)}`,
        symbol: data.symbol,
        price: fillPrice,
        referenceId: data.orderId ? `order-filled-${data.orderId}` : undefined,
        notificationType: 'success',
      });
    },

    handlePositionClosed: (data) => {
      const exitReason = String(data.exitReason || '');
      const exitPrice = Number(data.exitPrice || 0);
      const pnl = Number(data.pnl || 0);
      const pnlText = pnl >= 0 ? `+₹${pnl.toFixed(2)}` : `-₹${Math.abs(pnl).toFixed(2)}`;

      if (exitReason === 'TARGET_HIT') {
        if (!get().eventSettings.targetHit) return false;
        return emitAlert({
          kind: 'TARGET_HIT',
          title: 'Target Hit',
          message: `${data.displayName} ${data.side} closed @ ${exitPrice.toFixed(2)} | P&L: ${pnlText}`,
          symbol: data.symbol,
          price: exitPrice,
          referenceId: data.positionId ? `target-hit-${data.positionId}-${data.exitQty || data.remainingQty || 'full'}` : undefined,
          notificationType: 'success',
        });
      }

      if (exitReason === 'SL_HIT') {
        if (!get().eventSettings.slTrigger) return false;
        return emitAlert({
          kind: 'SL_TRIGGER',
          title: 'Stop Loss Triggered',
          message: `${data.displayName} ${data.side} closed @ ${exitPrice.toFixed(2)} | P&L: ${pnlText}`,
          symbol: data.symbol,
          price: exitPrice,
          referenceId: data.positionId ? `sl-hit-${data.positionId}` : undefined,
          notificationType: 'warning',
        });
      }

      return false;
    },

    processTicks: (ticks) => {
      if (ticks.length === 0) return;

      const tickMap: Record<string, number> = {};
      ticks.forEach((tick) => {
        tickMap[tick.symbol] = tick.ltp;
      });

      const triggered: Array<{ alert: LtpAlert; ltp: number; triggeredAt: number }> = [];

      set((state) => {
        const nextAlerts = state.ltpAlerts.map((alert) => {
          if (!alert.isEnabled || alert.isTriggered) return alert;

          const ltp = tickMap[alert.symbol];
          if (!Number.isFinite(ltp)) return alert;

          const crossed =
            alert.condition === 'ABOVE'
              ? ltp >= alert.targetPrice
              : ltp <= alert.targetPrice;

          if (!crossed) return alert;

          const triggeredAt = Date.now();
          triggered.push({ alert, ltp, triggeredAt });

          return {
            ...alert,
            isTriggered: true,
            triggeredAt,
          };
        });

        return triggered.length > 0 ? { ltpAlerts: nextAlerts } : state;
      });

      if (triggered.length === 0) return;
      persistState(get());

      triggered.forEach(({ alert, ltp, triggeredAt }) => {
        emitAlert({
          kind: 'LTP_TRIGGER',
          title: 'LTP Alert Triggered',
          message: `${alert.displayName} ${alert.condition === 'ABOVE' ? 'crossed above' : 'crossed below'} ${alert.targetPrice.toFixed(2)} (LTP: ${ltp.toFixed(2)})`,
          symbol: alert.symbol,
          price: ltp,
          referenceId: `ltp-${alert.id}-${triggeredAt}`,
          notificationType: 'info',
        });
      });
    },

    setRepeatDuration: (kind, duration) => {
      set((state) => ({
        repeatDurations: { ...state.repeatDurations, [kind]: duration },
      }));
      persistState(get());
    },

    setCustomSoundForKind: (kind, sound) => {
      const previous = get().customSounds[kind];
      if (previous?.objectUrl && (!sound || previous.objectUrl !== sound.objectUrl)) {
        URL.revokeObjectURL(previous.objectUrl);
      }

      set((state) => {
        const next = { ...state.customSounds };
        if (!sound) {
          delete next[kind];
        } else {
          next[kind] = sound;
        }
        return { customSounds: next };
      });
    },

    playAlertSound: (kind = 'POSITION_FILLED') => {
      const state = get();
      if (state.desktopOnlyMode || !useUIStore.getState().soundEnabled) return;
      playConfiguredSound(kind);
    },

    setDesktopOnlyMode: (enabled) => {
      set({ desktopOnlyMode: enabled });
      persistState(get());
    },

    requestDesktopPermission: async () => {
      if (typeof window === 'undefined' || !('Notification' in window)) {
        set({ notificationPermission: 'unsupported' });
        return 'unsupported';
      }

      const permission = await Notification.requestPermission();
      set({ notificationPermission: permission });
      return permission;
    },

    syncNotificationPermission: () => {
      set({ notificationPermission: getNotificationPermission() });
    },

    clearAlertHistory: () => {
      set({ alertHistory: [] });
      persistState(get());
    },
  };
});

