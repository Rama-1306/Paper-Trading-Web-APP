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
        // WU Precision Ledger — Material You Light palette
        'primary':                  '#745b00',
        'primary-container':        '#ffcc00',
        'on-primary':               '#ffffff',
        'on-primary-fixed':         '#241a00',
        'on-primary-container':     '#6f5700',
        'primary-fixed':            '#ffe08b',
        'primary-fixed-dim':        '#f1c100',
        'on-primary-fixed-variant': '#584400',
        'inverse-primary':          '#f1c100',
        'surface-tint':             '#745b00',

        'secondary':                    '#5e5e5e',
        'secondary-container':          '#e2e2e2',
        'on-secondary':                 '#ffffff',
        'on-secondary-container':       '#646464',
        'secondary-fixed':              '#e2e2e2',
        'secondary-fixed-dim':          '#c6c6c6',
        'on-secondary-fixed':           '#1b1b1b',
        'on-secondary-fixed-variant':   '#474747',

        'tertiary':                    '#3059b7',
        'tertiary-container':          '#c3d1ff',
        'on-tertiary':                 '#ffffff',
        'on-tertiary-container':       '#2b55b2',
        'tertiary-fixed':              '#dae2ff',
        'tertiary-fixed-dim':          '#b2c5ff',
        'on-tertiary-fixed':           '#001848',
        'on-tertiary-fixed-variant':   '#0b409e',

        'background':           '#fbf9f5',
        'on-background':        '#1b1c1a',

        'surface':                  '#fbf9f5',
        'surface-dim':              '#dbdad6',
        'surface-bright':           '#fbf9f5',
        'surface-container-lowest': '#ffffff',
        'surface-container-low':    '#f5f3ef',
        'surface-container':        '#efeee9',
        'surface-container-high':   '#eae8e4',
        'surface-container-highest':'#e4e2de',
        'surface-variant':          '#e4e2de',
        'on-surface':               '#1b1c1a',
        'on-surface-variant':       '#4e4632',
        'inverse-surface':          '#30312e',
        'inverse-on-surface':       '#f2f1ec',

        'outline':          '#80765f',
        'outline-variant':  '#d2c5ab',

        'error':            '#ba1a1a',
        'error-container':  '#ffdad6',
        'on-error':         '#ffffff',
        'on-error-container': '#93000a',
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
