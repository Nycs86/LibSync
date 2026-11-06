
const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  "https://libsync-backend.onrender.com"
).replace(/\/+$/, "");

// GET TOKEN FOR THIS TAB ONLY
export const getAccessToken = () => {
  return sessionStorage.getItem("accessToken");
};

// GET USER FOR THIS TAB ONLY
export const getStoredUser = () => {
  try {
    const user = sessionStorage.getItem("loggedInUser");
    return user ? JSON.parse(user) : null;
  } catch {
    return null;
  }
};

// SAVE LOGIN SESSION FOR THIS TAB ONLY
export const saveAuthSession = (data) => {
  if (!data?.access_token || !data?.user) {
    throw new Error("Invalid login response from server.");
  }

  clearAuthSession();

  sessionStorage.setItem("accessToken", data.access_token);
  sessionStorage.setItem("loggedInUser", JSON.stringify(data.user));
};

// CLEAR ONLY THIS TAB'S LOGIN SESSION
export const clearAuthSession = () => {
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

  const result = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

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
  get: (path, options = {}) =>
    apiRequest(path, options),

  post: (path, data, options = {}) =>
    apiRequest(path, {
      ...options,
      method: "POST",
      body: data,
    }),

  put: (path, data, options = {}) =>
    apiRequest(path, {
      ...options,
      method: "PUT",
      body: data,
    }),

  delete: (path, options = {}) =>
    apiRequest(path, {
      ...options,
      method: "DELETE",
    }),
};
