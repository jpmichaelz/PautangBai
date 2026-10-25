/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#252B29', // ink-900
    textSecondary: '#66716D', // slate-600
    background: '#BCE9CA', // Richer fresh green
    card: '#FFFFFF',
    border: '#A6D9B6', // border-200
    primary: '#287A63', // green-700
    primaryDark: '#173D35', // forest-900
    accent: '#F0B85A', // amber-500
    mint: '#A8DCC5', // mint-300
    danger: '#B83D3D', // danger-600
    success: '#24724F', // success-700
    warning: '#94600B', // warning-700
    backgroundElement: '#ABE0BC',
    backgroundSelected: '#9BD4AD',
  },
  dark: {
    text: '#F5F7F6',
    textSecondary: '#A2ACA7',
    background: '#121C1A',
    card: '#1A2724',
    border: '#2C3B37',
    primary: '#75C99C',
    primaryDark: '#287A63',
    accent: '#F0B85A',
    mint: '#24724F',
    danger: '#E56D6D',
    success: '#75C99C',
    warning: '#E2A944',
    backgroundElement: '#22322E',
    backgroundSelected: '#2C403B',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
