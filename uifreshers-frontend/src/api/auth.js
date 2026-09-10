import client, { setTokens, clearTokens } from "./client";

export async function registerWithEmail({ full_name, email, password }) {
  const { data } = await client.post("/auth/register", { full_name, email, password });
  setTokens(data);
  return data;
}

export async function loginWithEmail({ email, password }) {
  const { data } = await client.post("/auth/login", { email, password });
  setTokens(data);
  return data;
}

export async function loginWithGoogle(id_token) {
  const { data } = await client.post("/auth/google", { id_token });
  setTokens(data);
  return data;
}

export async function fetchCurrentUser() {
  const { data } = await client.get("/auth/me");
  return data;
}

export async function logout() {
  const refresh_token = localStorage.getItem("uif_refresh_token");
  try {
    if (refresh_token) await client.post("/auth/logout", { refresh_token });
  } finally {
    clearTokens();
  }
}
