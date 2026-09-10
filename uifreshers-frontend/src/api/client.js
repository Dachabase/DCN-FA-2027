import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";

const client = axios.create({ baseURL: BASE_URL });

function getTokens() {
  return {
    access: localStorage.getItem("uif_access_token"),
    refresh: localStorage.getItem("uif_refresh_token"),
  };
}

export function setTokens({ access_token, refresh_token }) {
  if (access_token) localStorage.setItem("uif_access_token", access_token);
  if (refresh_token) localStorage.setItem("uif_refresh_token", refresh_token);
}

export function clearTokens() {
  localStorage.removeItem("uif_access_token");
  localStorage.removeItem("uif_refresh_token");
}

client.interceptors.request.use((config) => {
  const { access } = getTokens();
  if (access) config.headers.Authorization = `Bearer ${access}`;
  return config;
});

// On 401, try a single refresh-and-retry before giving up.
let isRefreshing = false;
let queue = [];

client.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error);
    }

    const { refresh } = getTokens();
    if (!refresh) {
      clearTokens();
      return Promise.reject(error);
    }

    original._retry = true;

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        queue.push({ resolve, reject, original });
      });
    }

    isRefreshing = true;
    try {
      const { data } = await axios.post(`${BASE_URL}/auth/refresh`, {
        refresh_token: refresh,
      });
      setTokens(data);
      queue.forEach(({ resolve, original: o }) => {
        o.headers.Authorization = `Bearer ${data.access_token}`;
        resolve(client(o));
      });
      queue = [];
      original.headers.Authorization = `Bearer ${data.access_token}`;
      return client(original);
    } catch (refreshError) {
      queue.forEach(({ reject }) => reject(refreshError));
      queue = [];
      clearTokens();
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

export default client;
