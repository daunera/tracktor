import type { ThemeName, ThemeConfig } from '$lib/types/theme';

const THEME_STORAGE_KEY = 'tracktor-theme';

/**
 * Get the theme from localStorage
 */
export function getStoredTheme(): ThemeName | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  return (stored as ThemeName) || null;
}

/**
 * Save theme to localStorage
 */
export function saveTheme(theme: ThemeName): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(THEME_STORAGE_KEY, theme);
}

const THEME_STYLE_ID = 'tracktor-theme-vars';

// CSS variable names that the theme can override (snake_case = CSS var name)
const THEME_CSS_VARS = ['--primary', '--primary-foreground', '--ring'] as const;

function cssValue(key: string, colors?: Record<string, string | undefined>): string {
  const camelKey = key.replace(/^--/, '').replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  return colors?.[camelKey] ?? '';
}

function buildThemeCss(
  lightColors?: ThemeConfig['colors'],
  darkColors?: ThemeConfig['darkColors']
): string {
  const lines: string[] = [];

  lines.push(':root {');
  for (const cssVar of THEME_CSS_VARS) {
    const val = cssValue(cssVar, lightColors);
    if (val) lines.push(`  ${cssVar}: ${val};`);
  }
  lines.push('}');

  lines.push('.dark {');
  for (const cssVar of THEME_CSS_VARS) {
    const val = cssValue(cssVar, darkColors);
    if (val) lines.push(`  ${cssVar}: ${val};`);
  }
  lines.push('}');

  return lines.join('\n');
}

/**
 * Apply theme CSS variables to the document via a <style> element.
 * Uses both :root and .dark selectors so the CSS cascade correctly
 * handles dark/light mode switching without inline-style specificity issues.
 */
export function applyThemeColors(
  lightColors?: ThemeConfig['colors'],
  darkColors?: ThemeConfig['darkColors']
): void {
  if (typeof document === 'undefined') return;

  // Remove any previously-set inline styles to avoid specificity conflicts
  const root = document.documentElement;
  for (const cssVar of THEME_CSS_VARS) {
    root.style.removeProperty(cssVar);
  }

  // Inject (or update) a stylesheet block that respects the cascade
  let styleEl = document.getElementById(THEME_STYLE_ID) as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = THEME_STYLE_ID;
    document.head.appendChild(styleEl);
  }

  styleEl.textContent = buildThemeCss(lightColors, darkColors);
}

/**
 * Reset theme to default (remove injected stylesheet)
 */
export function resetThemeColors(): void {
  if (typeof document === 'undefined') return;
  const styleEl = document.getElementById(THEME_STYLE_ID);
  if (styleEl) styleEl.remove();

  const root = document.documentElement;
  for (const cssVar of THEME_CSS_VARS) {
    root.style.removeProperty(cssVar);
  }
}

/**
 * Add or remove theme class from HTML element
 */
export function setThemeClass(theme: ThemeName): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.setAttribute('data-theme', theme);
}

/**
 * Get the current system theme preference
 */
export function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
