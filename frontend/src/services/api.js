
const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:5000"
).replace(/\/+$/, "");

// GET TOKEN FROM EITHER STORAGE
export const getAccessToken = () => {
  return (
    localStorage.getItem("accessToken") ||
    sessionStorage.getItem("accessToken")
  );
};

// GET SAVED USER
export const getStoredUser = () => {
  try {
    const user =
      localStorage.getItem("loggedInUser") ||
      sessionStorage.getItem("loggedInUser");

    return user ? JSON.parse(user) : null;
  } catch {
    return null;
  }
};

// SAVE LOGIN SESSION
export const saveAuthSession = (data, rememberMe = true) => {
  if (!data?.access_token || !data?.user) {
    throw new Error("Invalid login response from server.");
  }

  // Clear previous session first
  clearAuthSession();

  // Choose storage based on Remember Me
  const storage = rememberMe ? localStorage : sessionStorage;

  storage.setItem("accessToken", data.access_token);
  storage.setItem("loggedInUser", JSON.stringify(data.user));
};

// CLEAR LOGIN SESSION
export const clearAuthSession = () => {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("loggedInUser");

  sessionStorage.removeItem("accessToken");
  sessionStorage.removeItem("loggedInUser");
};

// CENTRALIZED API REQUEST
export const apiRequest = async (path, options = {}) => {
  const headers = new Headers(options.headers || {});

  headers.set("Accept", "application/json");

  let body = options.body;

  if (
    body !== undefined &&
    body !== null &&
    typeof body !== "string" &&
    !(typeof FormData !== "undefined" && body instanceof FormData)
  ) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(body);
  }

  // Automatically attach JWT token
  const token = getAccessToken();

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const endpoint = path.startsWith("/")
    ? `${API_BASE_URL}${path}`
    : `${API_BASE_URL}/${path}`;

  const response = await fetch(endpoint, {
    ...options,
    headers,
    body,
  });

  const contentType = response.headers.get("content-type") || "";

  let result;

  if (contentType.includes("application/json")) {
    result = await response.json();
  } else {
    result = await response.text();
  }

  if (!response.ok) {
    const message =
      typeof result === "object" && result !== null
        ? result.message || result.error
        : result;

    const error = new Error(
      message || `Request failed (${response.status})`
    );

    error.status = response.status;
    error.payload = result;

    throw error;
  }

  return result;
};

// REUSABLE API METHODS
export const api = {
  get: (path) => apiRequest(path),

  post: (path, data) =>
    apiRequest(path, {
      method: "POST",
      body: data,
    }),

  put: (path, data) =>
    apiRequest(path, {
      method: "PUT",
      body: data,
    }),

  delete: (path) =>
    apiRequest(path, {
      method: "DELETE",
    }),
};
