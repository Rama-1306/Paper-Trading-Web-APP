'use client';

import { useState, useEffect, useCallback } from 'react';
import { useMarketStore } from '@/stores/marketStore';
import { useTradingStore } from '@/stores/tradingStore';
import { formatINR } from '@/lib/utils/formatters';

interface WatchlistItemData {
  id: string;
  symbol: string;
  displayName: string;
}

interface WatchlistData {
  id: string;
  name: string;
  items: WatchlistItemData[];
}

export function WatchlistPanel() {
  const [watchlists, setWatchlists] = useState<WatchlistData[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [newListName, setNewListName] = useState('');
  const [showNewInput, setShowNewInput] = useState(false);
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [addSymbolInput, setAddSymbolInput] = useState('');
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const ticks = useMarketStore((s) => s.ticks);

  const fetchWatchlists = useCallback(async () => {
    try {
      const res = await fetch('/api/watchlists');
      if (res.ok) {
        const data = await res.json();
        setWatchlists(data);
      }
    } catch (e) {
      console.error('Failed to fetch watchlists:', e);
    }
  }, []);

  useEffect(() => {
    fetchWatchlists();
  }, [fetchWatchlists]);

  const createList = async () => {
    if (!newListName.trim()) return;
    try {
      const res = await fetch('/api/watchlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newListName.trim() }),
      });
      if (res.ok) {
        setNewListName('');
        setShowNewInput(false);
        fetchWatchlists();
      }
    } catch (e) {
      console.error('Failed to create watchlist:', e);
    }
  };

  const deleteList = async (watchlistId: string) => {
    try {
      await fetch('/api/watchlists', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ watchlistId }),
      });
      fetchWatchlists();
    } catch (e) {
      console.error('Failed to delete watchlist:', e);
    }
  };

  const renameList = async (watchlistId: string) => {
    if (!renameValue.trim()) return;
    try {
      await fetch('/api/watchlists', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ watchlistId, name: renameValue.trim() }),
      });
      setRenaming(null);
      fetchWatchlists();
    } catch (e) {
      console.error('Failed to rename watchlist:', e);
    }
  };

  const addSymbol = async (watchlistId: string) => {
    if (!addSymbolInput.trim()) return;
    const sym = addSymbolInput.trim().toUpperCase();
    const parts = sym.split(':');
    const display = parts.length > 1 ? parts[1] : sym;
    try {
      await fetch('/api/watchlists', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ watchlistId, addSymbol: sym, addDisplayName: display }),
      });
      setAddSymbolInput('');
      setAddingTo(null);
      fetchWatchlists();
    } catch (e) {
      console.error('Failed to add symbol:', e);
    }
  };

  const removeItem = async (watchlistId: string, itemId: string) => {
    try {
      await fetch('/api/watchlists', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ watchlistId, removeItemId: itemId }),
      });
      fetchWatchlists();
    } catch (e) {
      console.error('Failed to remove item:', e);
    }
  };

  const selectSymbol = (symbol: string) => {
    useMarketStore.getState().setActiveSymbol(symbol);
    useTradingStore.getState().setSelectedSymbol(symbol);
  };

  return (
    <div className="wl-container">
      <div className="wl-toolbar">
        <span className="wl-title">Watchlists</span>
        <button
          className="wl-add-btn"
          onClick={() => setShowNewInput(!showNewInput)}
          title="Create new watchlist"
        >
          + New List
        </button>
      </div>

      {showNewInput && (
        <div className="wl-new-form">
          <input
            className="wl-input"
            value={newListName}
            onChange={(e) => setNewListName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && createList()}
            placeholder="List name..."
            autoFocus
          />
          <button className="wl-btn-confirm" onClick={createList}>Create</button>
          <button className="wl-btn-cancel" onClick={() => { setShowNewInput(false); setNewListName(''); }}>Cancel</button>
        </div>
      )}

      {watchlists.length === 0 && !showNewInput && (
        <div className="empty-state" style={{ padding: '20px 0' }}>
          <div className="empty-state-icon">📋</div>
          <div className="empty-state-text">No watchlists yet</div>
          <div style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '4px' }}>
            Click "+ New List" to create one
          </div>
        </div>
      )}

      <div className="wl-lists">
        {watchlists.map((wl) => {
          const isOpen = expandedId === wl.id;
          const isRenaming = renaming === wl.id;
          return (
            <div key={wl.id} className="wl-group">
              <div className="wl-group-header">
                <button className="wl-group-toggle" onClick={() => setExpandedId(isOpen ? null : wl.id)}>
                  <span className="wl-arrow">{isOpen ? '▾' : '▸'}</span>
                  {isRenaming ? (
                    <input
                      className="wl-input wl-rename-input"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') renameList(wl.id);
                        if (e.key === 'Escape') setRenaming(null);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      autoFocus
                    />
                  ) : (
                    <span className="wl-group-name">{wl.name}</span>
                  )}
                  <span className="wl-group-count">{wl.items.length}</span>
                </button>
                <div className="wl-group-actions">
                  {isRenaming ? (
                    <>
                      <button className="wl-action" onClick={() => renameList(wl.id)} title="Save">&#10003;</button>
                      <button className="wl-action" onClick={() => setRenaming(null)} title="Cancel">&#10005;</button>
                    </>
                  ) : (
                    <>
                      <button className="wl-action" onClick={() => { setAddingTo(addingTo === wl.id ? null : wl.id); setAddSymbolInput(''); }} title="Add symbol">+</button>
                      <button className="wl-action" onClick={() => { setRenaming(wl.id); setRenameValue(wl.name); }} title="Rename">&#9998;</button>
                      <button className="wl-action wl-action-delete" onClick={() => deleteList(wl.id)} title="Delete list">&#128465;</button>
                    </>
                  )}
                </div>
              </div>

              {isOpen && (
                <div className="wl-items">
                  {addingTo === wl.id && (
                    <div className="wl-add-symbol-form">
                      <input
                        className="wl-input"
                        value={addSymbolInput}
                        onChange={(e) => setAddSymbolInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addSymbol(wl.id)}
                        placeholder="e.g. NSE:BANKNIFTY26MARFUT"
                        autoFocus
                      />
                      <button className="wl-btn-confirm" onClick={() => addSymbol(wl.id)}>Add</button>
                    </div>
                  )}
                  {wl.items.length === 0 && addingTo !== wl.id && (
                    <div className="wl-empty-list">No symbols added</div>
                  )}
                  {wl.items.map((item) => {
                    const tick = ticks[item.symbol];
                    const ltp = tick?.ltp;
                    const change = tick?.change ?? 0;
                    const changePct = tick?.changePercent ?? 0;
                    return (
                      <div key={item.id} className="wl-item" onClick={() => selectSymbol(item.symbol)}>
                        <span className="wl-item-name">{item.displayName}</span>
                        {ltp !== undefined ? (
                          <div className="wl-item-price-area">
                            <span className="wl-item-ltp">{ltp.toFixed(2)}</span>
                            <span className={`wl-item-change ${change >= 0 ? 'profit' : 'loss'}`}>
                              {change >= 0 ? '+' : ''}{change.toFixed(2)} ({changePct.toFixed(2)}%)
                            </span>
                          </div>
                        ) : (
                          <span className="wl-item-no-data">--</span>
                        )}
                        <button
                          className="wl-item-remove"
                          onClick={(e) => { e.stopPropagation(); removeItem(wl.id, item.id); }}
                          title="Remove"
                        >
                          &#10005;
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
