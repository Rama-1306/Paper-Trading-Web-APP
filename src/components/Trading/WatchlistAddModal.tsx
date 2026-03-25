'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useUIStore } from '@/stores/uiStore';

interface WatchlistData {
  id: string;
  name: string;
  items: { id: string; symbol: string; displayName: string }[];
}

interface WatchlistAddModalProps {
  symbol: string;
  displayName: string;
  position: { x: number; y: number };
  onClose: () => void;
}

export function WatchlistAddModal({ symbol, displayName, position, onClose }: WatchlistAddModalProps) {
  const [watchlists, setWatchlists] = useState<WatchlistData[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState<string | null>(null);
  const [showNewInput, setShowNewInput] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [creating, setCreating] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const addNotification = useUIStore((s) => s.addNotification);

  const fetchWatchlists = useCallback(async () => {
    try {
      const res = await fetch('/api/watchlists');
      if (res.ok) {
        const data = await res.json();
        setWatchlists(data);
      }
    } catch (e) {
      console.error('Failed to fetch watchlists:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWatchlists();
  }, [fetchWatchlists]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Use a small timeout so the click that opened the modal doesn't immediately close it
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 50);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  // Keep modal within viewport
  const getPosition = () => {
    const modalWidth = 240;
    const modalHeight = 280;
    let x = position.x;
    let y = position.y;

    if (typeof window !== 'undefined') {
      if (x + modalWidth > window.innerWidth) {
        x = window.innerWidth - modalWidth - 12;
      }
      if (y + modalHeight > window.innerHeight) {
        y = window.innerHeight - modalHeight - 12;
      }
      if (x < 8) x = 8;
      if (y < 8) y = 8;
    }

    return { left: x, top: y };
  };

  const addToWatchlist = async (watchlistId: string) => {
    setAdding(watchlistId);
    try {
      const res = await fetch('/api/watchlists', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          watchlistId,
          addSymbol: symbol,
          addDisplayName: displayName,
        }),
      });
      if (res.ok) {
        const wlName = watchlists.find(w => w.id === watchlistId)?.name || 'watchlist';
        addNotification({
          type: 'success',
          title: 'Added to Watchlist',
          message: `${displayName} added to "${wlName}"`,
        });
        onClose();
      }
    } catch (e) {
      console.error('Failed to add to watchlist:', e);
      addNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to add symbol to watchlist',
      });
    } finally {
      setAdding(null);
    }
  };

  const createAndAdd = async () => {
    if (!newListName.trim()) return;
    setCreating(true);
    try {
      // Create the new watchlist
      const createRes = await fetch('/api/watchlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newListName.trim() }),
      });
      if (createRes.ok) {
        const newList = await createRes.json();
        // Add symbol to the newly created list
        await fetch('/api/watchlists', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            watchlistId: newList.id,
            addSymbol: symbol,
            addDisplayName: displayName,
          }),
        });
        addNotification({
          type: 'success',
          title: 'Added to Watchlist',
          message: `${displayName} added to new list "${newListName.trim()}"`,
        });
        onClose();
      }
    } catch (e) {
      console.error('Failed to create watchlist:', e);
      addNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to create watchlist',
      });
    } finally {
      setCreating(false);
    }
  };

  const isAlreadyIn = (wl: WatchlistData) => wl.items.some(item => item.symbol === symbol);

  const pos = getPosition();

  return (
    <div className="wl-modal-overlay">
      <div
        ref={modalRef}
        className="wl-modal-popup"
        style={{ left: pos.left, top: pos.top }}
      >
        {/* Header */}
        <div className="wl-modal-header">
          <div className="wl-modal-title">Add to Watchlist</div>
          <button className="wl-modal-close" onClick={onClose}>&#10005;</button>
        </div>

        {/* Symbol being added */}
        <div className="wl-modal-symbol">{displayName}</div>

        {/* Watchlist items */}
        <div className="wl-modal-list">
          {loading ? (
            <div className="wl-modal-loading">Loading watchlists...</div>
          ) : watchlists.length === 0 && !showNewInput ? (
            <div className="wl-modal-empty">
              No watchlists yet. Create one below.
            </div>
          ) : (
            watchlists.map((wl) => {
              const alreadyAdded = isAlreadyIn(wl);
              return (
                <button
                  key={wl.id}
                  className={`wl-modal-item ${alreadyAdded ? 'wl-modal-item-added' : ''}`}
                  onClick={() => !alreadyAdded && addToWatchlist(wl.id)}
                  disabled={alreadyAdded || adding === wl.id}
                >
                  <span className="wl-modal-item-icon">
                    {alreadyAdded ? '✓' : '📋'}
                  </span>
                  <span className="wl-modal-item-name">{wl.name}</span>
                  <span className="wl-modal-item-count">{wl.items.length}</span>
                  {adding === wl.id && <span className="wl-modal-item-spinner">...</span>}
                  {alreadyAdded && <span className="wl-modal-item-badge">Added</span>}
                </button>
              );
            })
          )}
        </div>

        {/* Create new list */}
        {showNewInput ? (
          <div className="wl-modal-new-form">
            <input
              className="wl-modal-input"
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') createAndAdd();
                if (e.key === 'Escape') { setShowNewInput(false); setNewListName(''); }
              }}
              placeholder="List name..."
              autoFocus
              disabled={creating}
            />
            <button
              className="wl-modal-btn-create"
              onClick={createAndAdd}
              disabled={!newListName.trim() || creating}
            >
              {creating ? '...' : 'Create & Add'}
            </button>
          </div>
        ) : (
          <button
            className="wl-modal-new-btn"
            onClick={() => setShowNewInput(true)}
          >
            + Create New List
          </button>
        )}
      </div>
    </div>
  );
}
