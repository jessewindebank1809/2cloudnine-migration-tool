module.exports = new Proxy({}, {
  get: (target, prop) => {
    if (prop === '__esModule') {
      return true;
    }
    // Return a dummy component for any icon
    return () => null;
  }
});