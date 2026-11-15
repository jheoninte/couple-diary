// While the on-screen keyboard is up, hide the bottom tab bar (and anything marked to hide with it).
// iOS keeps fixed bottom elements above the keyboard, which leaves the tab bar floating mid-screen while typing.
const NO_KEYBOARD = new Set(['checkbox', 'radio', 'button', 'submit', 'reset', 'file', 'range', 'color', 'date', 'datetime-local', 'month', 'time', 'week', 'image', 'hidden']);
export function usesKeyboard(el) {
  if (!el || el.disabled || el.readOnly) return false;
  if (el.isContentEditable || el.tagName === 'TEXTAREA') return true;
  return el.tagName === 'INPUT' && !NO_KEYBOARD.has((el.type || 'text').toLowerCase());
}
export function watchKeyboard(doc = document) {
  const root = doc.documentElement;
  let timer = null;
  const sync = () => { timer = null; root.classList.toggle('keyboard-open', usesKeyboard(doc.activeElement)); };
  doc.addEventListener('focusin', event => { if (usesKeyboard(event.target)) { clearTimeout(timer); timer = null; root.classList.add('keyboard-open'); } });
  // Moving focus between two text fields fires focusout then focusin; wait a moment so the bar does not flash back.
  doc.addEventListener('focusout', () => { clearTimeout(timer); timer = setTimeout(sync, 120); });
  return sync;
}
if (typeof document !== 'undefined') watchKeyboard();
