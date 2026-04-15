import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // WU Precision Ledger — all values driven by CSS variables so
        // themes work by swapping :root overrides in globals.css.
        'primary':                  'var(--color-primary)',
        'primary-container':        'var(--color-primary-container)',
        'on-primary':               'var(--color-on-primary)',
        'on-primary-fixed':         'var(--color-on-primary-fixed)',
        'on-primary-container':     'var(--color-on-primary-container)',
        'primary-fixed':            'var(--color-primary-fixed)',
        'primary-fixed-dim':        'var(--color-primary-fixed-dim)',
        'on-primary-fixed-variant': 'var(--color-on-primary-fixed-variant)',
        'inverse-primary':          'var(--color-inverse-primary)',
        'surface-tint':             'var(--color-surface-tint)',

        'secondary':                    'var(--color-secondary)',
        'secondary-container':          'var(--color-secondary-container)',
        'on-secondary':                 'var(--color-on-secondary)',
        'on-secondary-container':       'var(--color-on-secondary-container)',
        'secondary-fixed':              'var(--color-secondary-fixed)',
        'secondary-fixed-dim':          'var(--color-secondary-fixed-dim)',
        'on-secondary-fixed':           'var(--color-on-secondary-fixed)',
        'on-secondary-fixed-variant':   'var(--color-on-secondary-fixed-variant)',

        'tertiary':                    'var(--color-tertiary)',
        'tertiary-container':          'var(--color-tertiary-container)',
        'on-tertiary':                 'var(--color-on-tertiary)',
        'on-tertiary-container':       'var(--color-on-tertiary-container)',
        'tertiary-fixed':              'var(--color-tertiary-fixed)',
        'tertiary-fixed-dim':          'var(--color-tertiary-fixed-dim)',
        'on-tertiary-fixed':           'var(--color-on-tertiary-fixed)',
        'on-tertiary-fixed-variant':   'var(--color-on-tertiary-fixed-variant)',

        'background':           'var(--color-background)',
        'on-background':        'var(--color-on-background)',

        'surface':                  'var(--color-surface)',
        'surface-dim':              'var(--color-surface-dim)',
        'surface-bright':           'var(--color-surface-bright)',
        'surface-container-lowest': 'var(--color-surface-container-lowest)',
        'surface-container-low':    'var(--color-surface-container-low)',
        'surface-container':        'var(--color-surface-container)',
        'surface-container-high':   'var(--color-surface-container-high)',
        'surface-container-highest':'var(--color-surface-container-highest)',
        'surface-variant':          'var(--color-surface-variant)',
        'on-surface':               'var(--color-on-surface)',
        'on-surface-variant':       'var(--color-on-surface-variant)',
        'inverse-surface':          'var(--color-inverse-surface)',
        'inverse-on-surface':       'var(--color-inverse-on-surface)',

        'outline':          'var(--color-outline)',
        'outline-variant':  'var(--color-outline-variant)',

        'error':              'var(--color-error)',
        'error-container':    'var(--color-error-container)',
        'on-error':           'var(--color-on-error)',
        'on-error-container': 'var(--color-on-error-container)',
      },
      fontFamily: {
        sans:     ['Plus Jakarta Sans', 'Inter', 'sans-serif'],
        headline: ['Plus Jakarta Sans', 'sans-serif'],
        body:     ['Plus Jakarta Sans', 'sans-serif'],
        mono:     ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '0.125rem',
        sm:      '0.125rem',
        md:      '0.25rem',
        lg:      '0.25rem',
        xl:      '0.5rem',
        '2xl':   '0.75rem',
        full:    '9999px',
      },
    },
  },
  plugins: [],
};

export default config;
