'use client';

import { useEffect } from 'react';
import { useUIStore } from '@/stores/uiStore';

export function ToastContainer() {
  const notifications = useUIStore((s) => s.notifications);
  const removeNotification = useUIStore((s) => s.removeNotification);

  // Auto-dismiss toasts after 4 seconds
  useEffect(() => {
    if (notifications.length === 0) return;

    const latest = notifications[notifications.length - 1];
    const timer = setTimeout(() => {
      removeNotification(latest.id);
    }, 4000);

    return () => clearTimeout(timer);
  }, [notifications, removeNotification]);

  if (notifications.length === 0) return null;

  return (
    <div className="toast-container">
      {notifications.slice(-5).map((notif) => (
        <div
          key={notif.id}
          className={`toast ${notif.type}`}
          onClick={() => removeNotification(notif.id)}
          style={{ cursor: 'pointer' }}
        >
          <div>
            <div className="toast-title">{notif.title}</div>
            <div className="toast-message">{notif.message}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
