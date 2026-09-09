import axios from 'axios';

/**
 * withCredentials is the whole reason the cookie works. Axios does not send
 * cookies on cross-origin requests without it, and although this app is
 * same-origin in both dev and production, leaving it off would silently break
 * every authenticated call.
 */
const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

let onUnauthorized = null;

/** AuthProvider registers a callback here so a 401 anywhere can clear the session. */
export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler;
}

/**
 * Flattens an axios error into the shape the API actually returns, so no
 * component ever has to reach through `error.response.data`.
 */
function normalizeError(error) {
  const data = error.response?.data;

  return {
    status: error.response?.status ?? 0,
    code: data?.code ?? 'NETWORK_ERROR',
    message:
      data?.message ??
      (error.response
        ? 'Something went wrong. Please try again.'
        : 'Cannot reach the server. Check your connection.'),
  };
}

client.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;

    // Auth endpoints opt out, because a 401 from them is a normal answer rather
    // than an expired session: /me 401s for any guest, and login 401s on a wrong
    // password. Treating either as an expiry sets the "session expired" notice
    // and redirects to the page the user is already on.
    const skip = error.config?.skipAuthRedirect;

    if (status === 401 && !skip && onUnauthorized) {
      onUnauthorized();
    }

    return Promise.reject(normalizeError(error));
  }
);

export default client;
