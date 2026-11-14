// Runs before Firebase modules so first launch never opens a blank authentication gate.
try {
  if (localStorage.getItem('diary.onboarding.v1') !== 'done' && !new URLSearchParams(location.search).has('archive')) {
    location.replace('onboarding.html' + location.search);
  }
} catch { /* Storage restrictions must not prevent login. */ }
