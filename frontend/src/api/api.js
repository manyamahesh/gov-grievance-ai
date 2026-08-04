import axios from "axios";

const API = axios.create({
  baseURL: process.env.REACT_APP_API_URL || "/api",
  withCredentials: true, // Send httpOnly cookies automatically (citizen_access_token and admin_access_token)
  headers: {
    "Content-Type": "application/json",
  },
});

// Interceptor to handle automatic admin refresh token retry on 401
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

API.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Trigger admin refresh token flow only for admin-specific 401s
    const isAdminRoute =
      originalRequest.url.includes("/admin/") ||
      originalRequest.url.includes("/tickets") ||
      originalRequest.url.includes("/analytics/");

    if (
      error.response &&
      error.response.status === 401 &&
      !originalRequest._retry &&
      isAdminRoute &&
      !originalRequest.url.includes("/admin/login") &&
      !originalRequest.url.includes("/admin/refresh")
    ) {
      originalRequest._retry = true;

      if (isRefreshing) {
        return new Promise(function (resolve, reject) {
          failedQueue.push({ resolve, reject });
        })
          .then(() => API(originalRequest))
          .catch((err) => Promise.reject(err));
      }

      isRefreshing = true;

      try {
        await API.post("/admin/refresh");
        isRefreshing = false;
        processQueue(null);
        return API(originalRequest);
      } catch (refreshError) {
        isRefreshing = false;
        processQueue(refreshError, null);
        if (window.location.pathname.startsWith("/dashboard")) {
          window.location.href = "/admin";
        }
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default API;
