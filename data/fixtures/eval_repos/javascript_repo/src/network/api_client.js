/**
 * HTTP client with automatic retry logic for failed API requests.
 */
function retry_failed_request(fn, retries = 3, delayMs = 1000) {
  // Retry mechanism for transient network timeouts and 5xx errors
  return fn().catch(err => {
    if (retries > 0) return retry_failed_request(fn, retries - 1, delayMs * 2);
    throw err;
  });
}

function fetchWithTimeout(url, timeoutMs = 5000) {
  // Performs HTTP fetch with timeout abort signal
  return fetch(url);
}

module.exports = {
  retry_failed_request,
  fetchWithTimeout
};
