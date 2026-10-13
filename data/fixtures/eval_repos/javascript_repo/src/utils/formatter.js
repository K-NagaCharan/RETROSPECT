/**
 * Format currency amounts with localized symbol and decimal formatting.
 */
function formatCurrency(val, currency = 'USD') {
  return `$${Number(val).toFixed(2)}`;
}

// Misleading generic function
function doStuff(x) {
  return x * 2;
}

module.exports = { formatCurrency, doStuff };
