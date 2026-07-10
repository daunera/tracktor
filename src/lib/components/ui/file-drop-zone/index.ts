import FileDropZone from './file-drop-zone.svelte';
import { type FileRejectedReason, type FileDropZoneProps } from './types';

/**
 * Parse a human-readable size string (e.g. "10M", "512Kb", "1G", "Infinity")
 * into a number of bytes. Returns `Infinity` for `"Infinity"` (case-insensitive).
 * Supports K/Kb (kilobytes), M/Mb (megabytes), G/Gb (gigabytes) suffixes.
 * A bare number is treated as bytes.
 */
export const parseSize = (value: string): number => {
  const trimmed = value.trim();
  if (trimmed.toLowerCase() === 'infinity') return Infinity;

  const match = trimmed.match(/^(\d+(?:\.\d+)?)\s*(Kb?|Mb?|Gb?)?$/i);
  if (!match) {
    // Fallback: try parsing as raw bytes
    const raw = Number(trimmed);
    return Number.isFinite(raw) ? raw : 10 * MEGABYTE;
  }

  const number = parseFloat(match[1]);
  const suffix = (match[2] || '').toLowerCase();

  switch (suffix) {
    case 'k':
    case 'kb':
      return number * KILOBYTE;
    case 'm':
    case 'mb':
      return number * MEGABYTE;
    case 'g':
    case 'gb':
      return number * GIGABYTE;
    default:
      return number;
  }
};

export const displaySize = (bytes: number): string => {
  if (bytes < KILOBYTE) return `${bytes.toFixed(0)} B`;

  if (bytes < MEGABYTE) return `${(bytes / KILOBYTE).toFixed(0)} KB`;

  if (bytes < GIGABYTE) return `${(bytes / MEGABYTE).toFixed(0)} MB`;

  return `${(bytes / GIGABYTE).toFixed(0)} GB`;
};

// Utilities for working with file sizes
export const BYTE = 1;
export const KILOBYTE = 1024;
export const MEGABYTE = 1024 * KILOBYTE;
export const GIGABYTE = 1024 * MEGABYTE;

// utilities for limiting accepted files
export const ACCEPT_IMAGE = 'image/*';
export const ACCEPT_VIDEO = 'video/*';
export const ACCEPT_AUDIO = 'audio/*';

export { FileDropZone, type FileRejectedReason, type FileDropZoneProps };
