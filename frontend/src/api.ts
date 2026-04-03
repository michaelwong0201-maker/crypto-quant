import axios from "axios";

const api = axios.create({
  baseURL: "/api",
});

export function setToken(token: string | null) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
    localStorage.setItem("cq_token", token);
  } else {
    delete api.defaults.headers.common.Authorization;
    localStorage.removeItem("cq_token");
  }
}

export function loadStoredToken() {
  const t = localStorage.getItem("cq_token");
  if (t) api.defaults.headers.common.Authorization = `Bearer ${t}`;
}

export default api;
