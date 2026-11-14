// No payment privileges live in this module. These helpers only control presentation.
export function annualDiscount(monthly, yearly) {
  return Math.floor((1 - yearly / (monthly * 12)) * 100);
}
export function activeMembership(state, now = Date.now()) {
  return (
    state?.premium === true &&
    Number.isSafeInteger(state.premiumUntil) &&
    state.premiumUntil > now
  );
}
export const AD_POLICY = Object.freeze({
  minimumSaves: 3,
  cooldownMs: 10 * 60 * 1000,
  maxPerDay: 2,
});
export function adDay(now) {
  const d = new Date(now);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}
export function recordSave(old, now) {
  const sameDay = old?.day === adDay(now);
  return {
    saves: Math.max(0, Number(old?.saves) || 0) + 1,
    day: adDay(now),
    shown: sameDay ? Math.max(0, Number(old?.shown) || 0) : 0,
    lastShown: Number(old?.lastShown) || 0,
  };
}
export function canShowInterstitial(counts, now) {
  return (
    counts.saves >= AD_POLICY.minimumSaves &&
    counts.shown < AD_POLICY.maxPerDay &&
    now - counts.lastShown >= AD_POLICY.cooldownMs
  );
}
