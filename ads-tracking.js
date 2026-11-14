// App Tracking Transparency: ask once, after the ad consent (UMP) step and before ads load.
// If the UMP "IDFA explainer" message already asked, the status is decided and nothing is shown again.
// iOS ignores the request while the app is not active (for example while a consent form is closing),
// so the app waits until it is visible, pauses briefly, and retries once if the request was ignored.
function whenVisible(doc) {
  if (!doc || doc.visibilityState === 'visible') return Promise.resolve();
  return new Promise(resolve => {
    const onChange = () => { if (doc.visibilityState === 'visible') { doc.removeEventListener('visibilitychange', onChange); resolve(); } };
    doc.addEventListener('visibilitychange', onChange);
  });
}
export async function ensureTrackingDecision(admob, { doc = globalThis.document, wait = ms => new Promise(r => setTimeout(r, ms)) } = {}) {
  try {
    let { status } = await admob.trackingAuthorizationStatus();
    for (let attempt = 0; status === 'notDetermined' && attempt < 2; attempt++) {
      await whenVisible(doc);
      await wait(attempt ? 1000 : 400);
      await admob.requestTrackingAuthorization();
      ({ status } = await admob.trackingAuthorizationStatus());
    }
    return status;
  } catch {
    return 'unknown';
  }
}
