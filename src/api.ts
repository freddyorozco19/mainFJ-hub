const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8001"

function getToken(): string | null {
  try {
    return localStorage.getItem("auth_token")
  } catch {
    return null
  }
}

interface ApiOptions extends Omit<RequestInit, "body"> {
  body?: unknown
}

export async function api(path: string, options: ApiOptions = {}): Promise<Response> {
  const token = getToken()
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  }

  if (token) {
    headers["Authorization"] = `Bearer ${token}`
  }

  if (options.body && typeof options.body !== "string" && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json"
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    body:
      options.body instanceof FormData || typeof options.body === "string"
        ? (options.body as BodyInit)
        : options.body
          ? JSON.stringify(options.body)
          : undefined,
  })

  if (res.status === 401) {
    localStorage.removeItem("auth_token")
    localStorage.removeItem("auth_user")
    window.location.href = "/login"
  }

  return res
}

export { API_BASE, getToken }