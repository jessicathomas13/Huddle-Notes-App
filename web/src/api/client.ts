const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

// Wraps fetch with the JWT automatically attached, and basic error handling
export async function apiFetch(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem("token");

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    let message = `API error: ${res.status}`;
    try {
      const data = await res.json();
      if (data?.message) message = data.message;
    } catch {
      //
    }
    throw new Error(message);
  }

  return res.json();
}