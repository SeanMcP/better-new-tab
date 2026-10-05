// Runs before first paint (classic, blocking script) so a custom theme doesn't flash the defaults.
// appearance.js keeps this mirror up to date; chrome.storage remains the source of truth.
try {
  const boot = JSON.parse(localStorage.getItem('appearance:boot'));
  if (boot) {
    const root = document.documentElement;
    for (const [name, value] of Object.entries(boot.vars)) root.style.setProperty(name, value);
    if (boot.theme) root.dataset.theme = boot.theme;
  }
} catch {
  // Defaults from styles.css apply.
}
