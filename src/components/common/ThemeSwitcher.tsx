'use client';

import { useState } from 'react';
import { useTheme, ThemeId } from '@/hooks/useTheme';

const THEMES: { id: ThemeId; label: string; preview: string }[] = [
    { id: 'light', label: 'WU Light', preview: '#fbf9f5' },
    { id: 'dark', label: 'WU Dark', preview: '#1a1816' },
    { id: 'ocean', label: 'Ocean', preview: '#0284c7' },
    { id: 'ocean-dark', label: 'Ocean Dark', preview: '#0c4a6e' },
    { id: 'forest', label: 'Forest', preview: '#15803d' },
    { id: 'forest-dark', label: 'Forest Dark', preview: '#14532d' },
    { id: 'purple', label: 'Purple', preview: '#7c3aed' },
    { id: 'purple-dark', label: 'Purple Dark', preview: '#2e1065' },
];

export function ThemeSwitcher() {
    const { theme, setTheme } = useTheme();
    const [isOpen, setIsOpen] = useState(false);

    const currentTheme = THEMES.find(t => t.id === theme) || THEMES[0];

    const handleSelect = (themeId: ThemeId) => {
        setTheme(themeId);
        setIsOpen(false);
    };

    return (
        <div style={{ position: 'relative' }}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 10px',
                    background: 'transparent',
                    border: '1px solid var(--wu-border-subtle)',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--wu-text-primary)',
                    transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--wu-bg-surface-raised)';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                }}
            >
                <span
                    style={{
                        width: '16px',
                        height: '16px',
                        borderRadius: '4px',
                        background: currentTheme.preview,
                        border: '1px solid var(--wu-border-subtle)',
                    }}
                />
                <span>{currentTheme.label}</span>
                <span
                    style={{
                        fontSize: '10px',
                        transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.15s',
                    }}
                >
                    ▼
                </span>
            </button>

            {isOpen && (
                <>
                    <div
                        style={{
                            position: 'fixed',
                            inset: 0,
                            zIndex: 99,
                        }}
                        onClick={() => setIsOpen(false)}
                    />
                    <div
                        style={{
                            position: 'absolute',
                            top: '100%',
                            right: 0,
                            marginTop: '4px',
                            background: 'var(--wu-bg-surface)',
                            border: '1px solid var(--wu-border-subtle)',
                            borderRadius: '8px',
                            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.12)',
                            padding: '8px',
                            zIndex: 100,
                            minWidth: '160px',
                        }}
                    >
                        <div
                            style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(2, 1fr)',
                                gap: '6px',
                            }}
                        >
                            {THEMES.map((t) => (
                                <button
                                    key={t.id}
                                    onClick={() => handleSelect(t.id)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        padding: '8px',
                                        background:
                                            theme === t.id
                                                ? 'var(--wu-bg-surface-raised)'
                                                : 'transparent',
                                        border:
                                            theme === t.id
                                                ? '1px solid var(--wu-accent)'
                                                : '1px solid transparent',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        fontSize: '11px',
                                        fontWeight: 600,
                                        color: 'var(--wu-text-primary)',
                                        transition: 'all 0.15s',
                                        textAlign: 'left',
                                    }}
                                >
                                    <span
                                        style={{
                                            width: '14px',
                                            height: '14px',
                                            borderRadius: '3px',
                                            background: t.preview,
                                            border:
                                                '1px solid var(--wu-border-subtle)',
                                            flexShrink: 0,
                                        }}
                                    />
                                    <span style={{ lineHeight: 1 }}>
                                        {t.label}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
