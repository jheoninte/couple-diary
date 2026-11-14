export function preserveEmulatorLinks(document, location) {
  if (!['localhost','127.0.0.1'].includes(location.hostname) || !new URLSearchParams(location.search).has('emulator')) return;
  for (const link of document.querySelectorAll('a[href]')) {
    const url = new URL(link.getAttribute('href'), location.href);
    if (url.origin === location.origin && url.pathname.endsWith('.html')) {
      url.searchParams.set('emulator', '1'); link.href = url.href;
    }
  }
}
if (typeof document !== 'undefined') preserveEmulatorLinks(document, location);
