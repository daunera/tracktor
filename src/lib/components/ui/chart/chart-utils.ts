import { getContext, setContext, type Component, type Snippet } from 'svelte';
import type { ChartState } from 'layerchart';

export const THEMES = { light: '', dark: '.dark' } as const;

export type ChartConfig = {
  [k in string]: {
    label?: string;
    icon?: Component;
  } & (
    | { color?: string; theme?: never }
    | { color?: never; theme: Record<keyof typeof THEMES, string> }
  );
};

export type ExtractSnippetParams<T> = T extends Snippet<[infer P]> ? P : never;

/**
 * The individual tooltip series item from layerchart's `ChartState`.
 *
 * `TooltipState`/`TooltipSeries` are internal to layerchart and not
 * re-exported through its public API, so this is derived via an indexed
 * access type off the publicly-exported `ChartState` (`ChartState.tooltip`
 * is a `TooltipState`, whose `series` field holds `TooltipSeries[]`). This
 * keeps the type in sync automatically if layerchart's internal shape
 * changes, since it only depends on a genuinely public symbol.
 *
 * The `config` field (a `SeriesData` entry) supports the ChartConfig-based
 * indicator color resolution used by Chart.Tooltip (`item.config?.color ||
 * item.color`).
 */
export type TooltipPayload = ChartState['tooltip']['series'][number];

// Helper to extract item config from a payload.
export function getPayloadConfigFromPayload(
  config: ChartConfig,
  payload: TooltipPayload,
  key: string,
  data?: Record<string, unknown> | null
) {
  if (typeof payload !== 'object' || payload === null) return undefined;

  const payloadConfig =
    'config' in payload && typeof payload.config === 'object' && payload.config !== null
      ? payload.config
      : undefined;

  let configLabelKey: string = key;

  if (payload.key === key) {
    configLabelKey = payload.key;
  } else if (payload.label === key) {
    configLabelKey = payload.label;
  } else if (key in payload && typeof payload[key as keyof typeof payload] === 'string') {
    configLabelKey = payload[key as keyof typeof payload] as string;
  } else if (
    payloadConfig !== undefined &&
    key in payloadConfig &&
    typeof payloadConfig[key as keyof typeof payloadConfig] === 'string'
  ) {
    configLabelKey = payloadConfig[key as keyof typeof payloadConfig] as string;
  } else if (data != null && key in data && typeof data[key] === 'string') {
    configLabelKey = data[key] as string;
  }

  return configLabelKey in config ? config[configLabelKey] : config[key as keyof typeof config];
}

type ChartContextValue = {
  config: ChartConfig;
};

const chartContextKey = Symbol('chart-context');

export function setChartContext(value: ChartContextValue) {
  return setContext(chartContextKey, value);
}

export function useChart() {
  return getContext<ChartContextValue>(chartContextKey);
}
