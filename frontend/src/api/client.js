import axios from "axios";
import { auth } from "../services/firebase";

const baseURL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

const api = axios.create({
  baseURL
});

api.interceptors.request.use(async (config) => {
  const user = auth.currentUser;
  if (user) {
    const token = await user.getIdToken();
    config.headers.Authorization = `Bearer ${token}`;
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
