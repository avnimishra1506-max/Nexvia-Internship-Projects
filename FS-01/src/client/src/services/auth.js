
const API_URL = `${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/auth`;

function getAuthHeaders() {
  const token = sessionStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function getNotificationPreferences() {
  const response = await fetch(`${API_URL}/me/notification-preferences`, {
    headers: getAuthHeaders(),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Could not load notification preferences");
  return data.preferences;
}

export async function saveNotificationPreferences(preferences) {
  const response = await fetch(`${API_URL}/me/notification-preferences`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify({ preferences }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Could not save notification preferences");
  return data.preferences;
}

export async function registerUser(formData) {
  const response = await fetch(`${API_URL}/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(formData),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Registration failed");
  }

  return data;
}

export async function loginUser(credentials) {
  const response = await fetch(`${API_URL}/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(credentials),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Login failed");
  }

  return data;
}
