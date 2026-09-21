/**
 * Hostinger-safe entry: panel may load this via require().
 * Boots the ESM server with dynamic import.
 */
(async () => {
  try {
    await import('./src/index.js');
  } catch (err) {
    console.error('CustodySteps failed to start:', err);
    process.exit(1);
  }
})();
