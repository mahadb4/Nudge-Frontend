/* Sets the theme before the first paint. It lives in a file, not inline, so the Content-Security-Policy can use script-src 'self'. */
(function () {
  try {
    var t = localStorage.getItem('nudge.theme');
    if (t !== 'light' && t !== 'dark' && t !== 'system') t = 'light';
    var dark = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'light');
  }
})();
