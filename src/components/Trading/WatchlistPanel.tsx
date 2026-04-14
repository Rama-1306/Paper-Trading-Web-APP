'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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

interface WatchlistPanelProps {
  onSelectInstrument?: (symbol: string) => void;
}

export function WatchlistPanel({ onSelectInstrument }: WatchlistPanelProps = {}) {
  const [watchlists, setWatchlists] = useState<WatchlistData[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [newListName, setNewListName] = useState('');
  const [showNewInput, setShowNewInput] = useState(false);
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [addSymbolInput, setAddSymbolInput] = useState('');
  const [searchResults, setSearchResults] = useState<{ value: string; label: string; lotSize?: number }[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  const handleSearchInput = (value: string) => {
    setAddSymbolInput(value);
    setSearchResults([]);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    const q = value.trim();
    if (q.length < 2) return;
    searchTimerRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await fetch(`/api/symbol-search?q=${encodeURIComponent(q)}&limit=10&type=all`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.results || []);
        }
      } catch {}
      setSearchLoading(false);
    }, 300);
  };

  const selectSearchResult = (watchlistId: string, result: { value: string; label: string; lotSize?: number }) => {
    const sym = result.value;
    const display = result.label;
    setAddSymbolInput(sym);
    setSearchResults([]);
    fetch('/api/watchlists', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ watchlistId, addSymbol: sym, addDisplayName: display }),
    }).then(() => {
      setAddSymbolInput('');
      setAddingTo(null);
      fetchWatchlists();
    }).catch(e => console.error('Failed to add symbol:', e));
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
      setSearchResults([]);
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
    if (onSelectInstrument) onSelectInstrument(symbol);
  };

  // ── Active watchlist tab (default to first) ─────────────────────────────
  const activeWlId = expandedId ?? (watchlists[0]?.id ?? null);
  const activeWl = watchlists.find(w => w.id === activeWlId) ?? null;
  const isRenaming = renaming === activeWlId;

  return (
    <div className="wl-container">
      {/* ── Top toolbar ── */}
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

      {/* ── Horizontal Tab Bar ── */}
      {watchlists.length > 0 && (
        <div style={{
          display: 'flex',
          overflowX: 'auto',
          borderBottom: '1px solid var(--border-primary)',
          background: 'var(--bg-secondary)',
          flexShrink: 0,
          scrollbarWidth: 'none',
        }}>
          {watchlists.map((wl) => (
            <button
              key={wl.id}
              onClick={() => setExpandedId(wl.id)}
              style={{
                padding: '8px 14px',
                fontSize: '12px',
                fontWeight: 600,
                whiteSpace: 'nowrap',
                background: 'transparent',
                border: 'none',
                borderBottom: activeWlId === wl.id ? '2px solid var(--color-accent)' : '2px solid transparent',
                color: activeWlId === wl.id ? 'var(--color-accent)' : 'var(--text-muted)',
                cursor: 'pointer',
                transition: 'color 0.15s',
                flexShrink: 0,
              }}
            >
              {wl.name}
              <span style={{ marginLeft: '5px', fontSize: '10px', opacity: 0.6 }}>({wl.items.length})</span>
            </button>
          ))}
        </div>
      )}

      {/* ── Active Watchlist Content ── */}
      {activeWl && (
        <div className="wl-lists">
          {/* Tab actions bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            padding: '6px 10px',
            gap: '6px',
            borderBottom: '1px solid var(--border-primary)',
            background: 'rgba(255,255,255,0.02)',
          }}>
            {isRenaming ? (
              <>
                <input
                  className="wl-input wl-rename-input"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') renameList(activeWl.id);
                    if (e.key === 'Escape') setRenaming(null);
                  }}
                  autoFocus
                  style={{ flex: 1 }}
                />
                <button className="wl-action" onClick={() => renameList(activeWl.id)} title="Save">&#10003;</button>
                <button className="wl-action" onClick={() => setRenaming(null)} title="Cancel">&#10005;</button>
              </>
            ) : (
              <>
                <span style={{ flex: 1, fontSize: '11px', color: 'var(--text-muted)' }}>{activeWl.items.length} symbols</span>
                <button className="wl-action" onClick={() => { setAddingTo(addingTo === activeWl.id ? null : activeWl.id); setAddSymbolInput(''); }} title="Add symbol">+</button>
                <button className="wl-action" onClick={() => { setRenaming(activeWl.id); setRenameValue(activeWl.name); }} title="Rename">&#9998;</button>
                <button className="wl-action wl-action-delete" onClick={() => deleteList(activeWl.id)} title="Delete list">&#128465;</button>
              </>
            )}
          </div>

          {/* Symbol search input */}
          {addingTo === activeWl.id && (
            <div className="wl-add-symbol-form" style={{ position: 'relative' }}>
              <input
                className="wl-input"
                value={addSymbolInput}
                onChange={(e) => handleSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchResults.length === 0) addSymbol(activeWl.id);
                  if (e.key === 'Escape') { setSearchResults([]); setAddingTo(null); }
                }}
                placeholder="Search symbol (e.g. BANKNIFTY, GOLD...)"
                autoFocus
              />
              <button className="wl-btn-confirm" onClick={() => addSymbol(activeWl.id)}>Add</button>
              {(searchResults.length > 0 || searchLoading) && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  zIndex: 100,
                  background: '#ffffff',
                  border: '1px solid #e4e2de',
                  borderRadius: '4px',
                  maxHeight: '200px',
                  overflowY: 'auto',
                  marginTop: '2px',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
                }}>
                  {searchLoading && (
                    <div style={{ padding: '8px 12px', fontSize: '11px', color: '#80765f' }}>
                      Searching...
                    </div>
                  )}
                  {searchResults.map((r) => (
                    <div
                      key={r.value}
                      onClick={() => selectSearchResult(activeWl.id, r)}
                      style={{
                        padding: '8px 12px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        borderBottom: '1px solid #e4e2de',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#f5f3ef')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <span style={{ color: '#1b1c1a', fontWeight: 600 }}>{r.label}</span>
                      <span style={{ color: '#80765f', marginLeft: '8px', fontSize: '10px' }}>{r.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Instrument list */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
          {activeWl.items.length === 0 && addingTo !== activeWl.id && (
            <div className="wl-empty-list">No symbols added. Click + to add.</div>
          )}
          {activeWl.items.map((item) => {
            const tick = ticks[item.symbol];
            const ltp = tick?.ltp;
            const change = tick?.change ?? 0;
            const changePct = tick?.changePercent ?? 0;
            return (
              <div
                key={item.id}
                className="wl-item"
                onClick={() => selectSymbol(item.symbol)}
                style={{ cursor: 'pointer' }}
                title="Click to place order"
              >
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
                  onClick={(e) => { e.stopPropagation(); removeItem(activeWl.id, item.id); }}
                  title="Remove"
                >
                  &#10005;
                </button>
              </div>
            );
          })}
          </div>
        </div>
      )}
    </div>
  );
}
