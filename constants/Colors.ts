const tintColorLight = '#8b5cf6'; // Soft Lavender for emphasis
const tintColorDark = '#a78bfa';

export default {
  palette: {
    primary: '#4285F4', // Blue from the mockup
    primaryDark: '#3367D6',
    textDark: '#111827',
    textMuted: '#6B7280',
    backgroundLight: '#F0FDF4', // Soft greenish background from mockup
    white: '#ffffff',
    border: '#E5E7EB'
  },
  light: {
    text: '#111827',
    background: '#ffffff',
    tint: tintColorLight,
    tabIconDefault: '#cbd5e1',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#f8fafc',
    background: '#0f172a',
    tint: tintColorLight,
    tabIconDefault: '#475569',
    tabIconSelected: tintColorLight,
  },
};
