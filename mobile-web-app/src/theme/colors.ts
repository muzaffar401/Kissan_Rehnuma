// ─── Material Design 3 Theme Palettes ───

export interface ColorPalette {
  primary: string;
  onPrimary: string;
  primaryContainer: string;
  onPrimaryContainer: string;
  surface: string;
  surfaceContainer: string;
  onSurface: string;
  onSurfaceVariant: string;
  background: string;
  onBackground: string;
  secondary: string;
  onSecondaryContainer: string;
  secondaryContainer: string;
  outline: string;
  outlineVariant: string;
  error: string;
  surfaceDim: string;
  surfaceContainerHigh: string;
  surfaceContainerLow: string;
  onTertiaryContainer: string;
  primaryFixedDim: string;
  errorContainer: string;
  onErrorContainer: string;
  surfaceContainerLowest: string;
  surfaceVariant: string;
  tertiaryContainer: string;
}

// Light theme — warm beige / sage green
export const lightColors: ColorPalette = {
  primary: '#325340',
  onPrimary: '#ffffff',
  primaryContainer: '#4a6b57',
  onPrimaryContainer: '#c5ead1',
  surface: '#fff8f2',
  surfaceContainer: '#f6ede0',
  onSurface: '#1f1b14',
  onSurfaceVariant: '#424843',
  background: '#fff8f2',
  onBackground: '#1f1b14',
  secondary: '#7d5714',
  onSecondaryContainer: '#78520f',
  secondaryContainer: '#fdc97b',
  outline: '#727973',
  outlineVariant: '#c1c8c1',
  error: '#ba1a1a',
  surfaceDim: '#e1d9cd',
  surfaceContainerHigh: '#f0e7da',
  surfaceContainerLow: '#f9f1e4',
  onTertiaryContainer: '#ffd9d2',
  primaryFixedDim: '#5a7d68',
  errorContainer: '#ffdad6',
  onErrorContainer: '#93000a',
  surfaceContainerLowest: '#ffffff',
  surfaceVariant: '#eae1d5',
  tertiaryContainer: '#9a4e40',
};

// Dark theme — deep forest green / warm charcoal
export const darkColors: ColorPalette = {
  primary: '#a8d5b9',
  onPrimary: '#003821',
  primaryContainer: '#3a5d48',
  onPrimaryContainer: '#c5ead1',
  surface: '#141411',
  surfaceContainer: '#1e1f1a',
  onSurface: '#e6e2d9',
  onSurfaceVariant: '#c1c8bf',
  background: '#141411',
  onBackground: '#e6e2d9',
  secondary: '#e4b86e',
  onSecondaryContainer: '#fdc97b',
  secondaryContainer: '#5e4112',
  outline: '#8b928a',
  outlineVariant: '#414941',
  error: '#ffb4ab',
  surfaceDim: '#141411',
  surfaceContainerHigh: '#282a24',
  surfaceContainerLow: '#1e1f1a',
  onTertiaryContainer: '#ffd9d2',
  primaryFixedDim: '#5a7d68',
  errorContainer: '#93000a',
  onErrorContainer: '#ffdad6',
  surfaceContainerLowest: '#0f0f0c',
  surfaceVariant: '#33372f',
  tertiaryContainer: '#7a3e32',
};

// Default export for backward compatibility (light mode)
export const colors = lightColors;
