// Pure weather helpers shared by the home strip, diary cards and tests.
export const WEATHER_ICONS = ['☀️', '🌙', '⛅', '☁️', '🌧️', '⛈️', '🌨️', '🌫️', '💨', '🌡️'];
export const LEGAL_URL = 'https://weatherkit.apple.com/legal-attribution.html';
// WeatherKit returns an SF Symbol name (e.g. "cloud.sun.rain"); the app shows one simple emoji for it.
export function weatherIcon(symbol = '') {
  const s = String(symbol);
  if (/bolt|thunder/.test(s)) return '⛈️';
  if (/snow|sleet|flurries|blizzard/.test(s)) return '🌨️';
  if (/rain|drizzle|hail/.test(s)) return '🌧️';
  if (/fog|haze|smoke|dust|sand/.test(s)) return '🌫️';
  if (/wind|tornado|hurricane|tropicalstorm/.test(s)) return '💨';
  if (/cloud\.sun/.test(s)) return '⛅';
  if (/cloud/.test(s)) return '☁️';
  if (/moon|stars/.test(s)) return '🌙';
  if (/sun|clear/.test(s)) return '☀️';
  return '🌡️';
}
// Countries that use Fahrenheit; everyone else sees Celsius. Uses the device region, not the app language.
const FAHRENHEIT = new Set(['US', 'LR', 'MM', 'BS', 'BZ', 'KY', 'PW', 'FM', 'MH']);
export function usesFahrenheit(locales = globalThis.navigator?.languages || [globalThis.navigator?.language || 'ko-KR']) {
  for (const tag of locales) { const region = String(tag).split(/[-_]/).find((part, i) => i > 0 && /^[A-Z]{2}$/i.test(part)); if (region) return FAHRENHEIT.has(region.toUpperCase()); }
  return false;
}
export function formatTemp(celsius, fahrenheit = usesFahrenheit()) {
  if (!Number.isFinite(celsius)) return '';
  return `${Math.round(fahrenheit ? celsius * 9 / 5 + 32 : celsius)}°`;
}
export const fresh = (row, maxAgeMs, now = Date.now()) => !!row && Number.isFinite(row.at) && now - row.at <= maxAgeMs && now - row.at >= -60000;
// What the device shares with the partner and stores on a new diary entry.
export function summary(raw) {
  if (!raw || !Number.isFinite(raw.temp)) return null;
  const row = { icon: weatherIcon(raw.symbol), temp: Math.round(raw.temp), city: String(raw.city || '').trim().slice(0, 60) };
  if (Number.isFinite(raw.high)) row.high = Math.round(raw.high);
  if (Number.isFinite(raw.low)) row.low = Math.round(raw.low);
  return row;
}
