'use client';

import { create } from 'zustand';
import type { Tick } from '@/types/market';
import { useUIStore } from '@/stores/uiStore';

export type LtpCondition = 'ABOVE' | 'BELOW';
export type AlertKind = 'POSITION_FILLED' | 'TARGET_HIT' | 'SL_TRIGGER' | 'LTP_TRIGGER';

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

interface PersistedAlertState {
  eventSettings: EventAlertSettings;
  ltpAlerts: LtpAlert[];
  alertHistory: AlertHistoryItem[];
}

interface AlertState {
  eventSettings: EventAlertSettings;
  ltpAlerts: LtpAlert[];
  alertHistory: AlertHistoryItem[];
  customSound: CustomAlertSound | null;
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
  setCustomSound: (sound: CustomAlertSound | null) => void;
  playAlertSound: () => void;
  clearAlertHistory: () => void;
}

const ALERT_STORAGE_KEY = 'paper-trader-alerts-v1';

const defaultEventSettings: EventAlertSettings = {
  positionFilled: true,
  targetHit: true,
  slTrigger: true,
};

const defaultPersistedState: PersistedAlertState = {
  eventSettings: defaultEventSettings,
  ltpAlerts: [],
  alertHistory: [],
};

function loadPersistedState(): PersistedAlertState {
  if (typeof window === 'undefined') return defaultPersistedState;

  try {
    const raw = localStorage.getItem(ALERT_STORAGE_KEY);
    if (!raw) return defaultPersistedState;

    const parsed = JSON.parse(raw) as Partial<PersistedAlertState>;
    return {
      eventSettings: {
        ...defaultEventSettings,
        ...(parsed.eventSettings || {}),
      },
      ltpAlerts: Array.isArray(parsed.ltpAlerts) ? parsed.ltpAlerts : [],
      alertHistory: Array.isArray(parsed.alertHistory) ? parsed.alertHistory.slice(0, 200) : [],
    };
  } catch {
    return defaultPersistedState;
  }
}

function persistState(state: Pick<AlertState, 'eventSettings' | 'ltpAlerts' | 'alertHistory'>) {
  if (typeof window === 'undefined') return;
  try {
    const payload: PersistedAlertState = {
      eventSettings: state.eventSettings,
      ltpAlerts: state.ltpAlerts,
      alertHistory: state.alertHistory.slice(0, 200),
    };
    localStorage.setItem(ALERT_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // ignore persistence errors (e.g., storage full / private mode)
  }
}

function playFallbackBeep() {
  if (typeof window === 'undefined') return;

  try {
    const AudioContextCtor =
      window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

    if (!AudioContextCtor) return;
    const ctx = new AudioContextCtor();
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
  } catch {
    // ignore audio errors
  }
}

const initialPersisted = loadPersistedState();

export const useAlertStore = create<AlertState>((set, get) => {
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

    useUIStore.getState().addNotification({
      type: input.notificationType || 'info',
      title: input.title,
      message: input.message,
    });

    if (useUIStore.getState().soundEnabled) {
      const customSound = get().customSound;
      if (customSound?.objectUrl) {
        const audio = new Audio(customSound.objectUrl);
        audio.play().catch(() => playFallbackBeep());
      } else {
        playFallbackBeep();
      }
    }

    return true;
  };

  return {
    eventSettings: initialPersisted.eventSettings,
    ltpAlerts: initialPersisted.ltpAlerts,
    alertHistory: initialPersisted.alertHistory,
    customSound: null,

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

    setCustomSound: (sound) => {
      const previous = get().customSound;
      if (previous?.objectUrl && (!sound || previous.objectUrl !== sound.objectUrl)) {
        URL.revokeObjectURL(previous.objectUrl);
      }
      set({ customSound: sound });
    },

    playAlertSound: () => {
      if (!useUIStore.getState().soundEnabled) return;
      const customSound = get().customSound;
      if (customSound?.objectUrl) {
        const audio = new Audio(customSound.objectUrl);
        audio.play().catch(() => playFallbackBeep());
      } else {
        playFallbackBeep();
      }
    },

    clearAlertHistory: () => {
      set({ alertHistory: [] });
      persistState(get());
    },
  };
});

