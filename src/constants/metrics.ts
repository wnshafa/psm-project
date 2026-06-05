export const SKIN_METRICS = [
  { key: 'hydration',   label: 'Hydration',   color: '#4ecdc4', icon: 'water-outline' },
  { key: 'oiliness',    label: 'Oiliness',    color: '#ff6b6b', icon: 'sunny-outline' },
  { key: 'sensitivity', label: 'Sensitivity', color: '#f7b731', icon: 'alert-circle-outline' },
  { key: 'brightness',  label: 'Brightness',  color: '#a29bfe', icon: 'sparkles-outline' },
] as const;

export type SkinMetricKey = typeof SKIN_METRICS[number]['key'];
