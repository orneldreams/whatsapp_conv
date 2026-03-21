import axios from "axios";

const baseURL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

const api = axios.create({
  baseURL
});

api.interceptors.request.use((config) => {
  const password = localStorage.getItem("dashboardPassword");
  if (password) {
    config.headers["x-dashboard-password"] = password;
  }
  return config;
});

export function getErrorMessage(error) {
  if (error?.response?.data?.error) {
    return error.response.data.error;
  }

  return error?.message || "Une erreur est survenue";
}

export default api;
