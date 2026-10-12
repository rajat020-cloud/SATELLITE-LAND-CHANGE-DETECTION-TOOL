export const COMPONENT_PALETTE = [
  '#ef4444', // Red (#1)
  '#f97316', // Orange (#2)
  '#eab308', // Yellow (#3)
  '#84cc16', // Lime (#4)
  '#06b6d4', // Cyan (#5)
  '#8b5cf6', // Violet (#6)
  '#ec4899', // Pink (#7)
  '#14b8a6'  // Teal (#8)
];

export function getComponentColor(componentId: number): string {
  if (componentId <= 0) return '#94a3b8';
  return COMPONENT_PALETTE[(componentId - 1) % COMPONENT_PALETTE.length];
}

/**
 * Maps an NDVI value in [-1, 1] to an [R, G, B] tuple.
 * Supports 'ndvi' (scientific vegetation palette) and 'grayscale' modes.
 */
export function ndviToRgb(
  ndvi: number | null,
  mode: 'ndvi' | 'grayscale' = 'ndvi'
): [number, number, number] {
  if (ndvi === null || !Number.isFinite(ndvi)) {
    // Cloud / invalid masked pixel shown as soft atmospheric slate-white
    return [216, 224, 234];
  }

  const clamped = Math.max(-1, Math.min(1, ndvi));

  if (mode === 'grayscale') {
    const lum = Math.round(((clamped + 1) / 2) * 235 + 10);
    return [lum, lum, lum];
  }

  // Water / negative NDVI: [-1.0, 0.0) -> deep navy/teal water channel
  if (clamped < 0) {
    const t = Math.max(0, Math.min(1, (clamped + 0.5) / 0.5));
    const r = Math.round(8 + t * 18);
    const g = Math.round(47 + t * 55);
    const b = Math.round(73 + t * 60);
    return [r, g, b];
  }

  // Bare soil / low NDVI: [0.0, 0.25) -> warm terracotta / amber-brown
  if (clamped < 0.25) {
    const t = clamped / 0.25;
    const r = Math.round(166 + t * 44); // 166 -> 210
    const g = Math.round(92 + t * 72);  // 92 -> 164
    const b = Math.round(46 + t * 38);  // 46 -> 84
    return [r, g, b];
  }

  // Sparse to moderate vegetation: [0.25, 0.55) -> warm sand to vibrant chartreuse/olive
  if (clamped < 0.55) {
    const t = (clamped - 0.25) / 0.30;
    const r = Math.round(210 - t * 115); // 210 -> 95
    const g = Math.round(164 + t * 24);  // 164 -> 188
    const b = Math.round(84 - t * 32);   // 84 -> 52
    return [r, g, b];
  }

  // Dense canopy: [0.55, 1.0] -> lush forest green to deep emerald
  const t = (clamped - 0.55) / 0.45;
  const r = Math.round(95 - t * 78);   // 95 -> 17
  const g = Math.round(188 - t * 78);  // 188 -> 110
  const b = Math.round(52 - t * 14);   // 52 -> 38
  return [r, g, b];
}

export function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const num = parseInt(clean, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}
