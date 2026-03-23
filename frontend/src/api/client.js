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

function looksTechnical(message) {
  return /axios|network error|failed to fetch|firebase|firestore|auth\/|permission|cors|jwt|token|timeout|status code|xmlhttprequest|cannot read|undefined|null|internal server error|request failed/i.test(message);
}

function sanitizeMessage(message) {
  const normalized = String(message || "").trim();

  if (!normalized) {
    return "Une erreur est survenue. Réessaie dans un instant.";
  }

  if (looksTechnical(normalized)) {
    return "Une erreur est survenue. Réessaie dans un instant.";
  }

  return normalized;
}

export function getErrorMessage(error) {
  const status = error?.response?.status;

  if (status === 401 || status === 403) {
    return "Ta session a expiré. Reconnecte-toi.";
  }

  if (status === 404) {
    return "Cette action est indisponible pour le moment.";
  }

  if (status >= 500) {
    return "Le service est momentanément indisponible.";
  }

  if (error?.response?.data?.error) {
    return sanitizeMessage(error.response.data.error);
  }

  return sanitizeMessage(error?.message);
}

export default api;
