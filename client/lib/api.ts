export function authHeaders(): HeadersInit {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`
  };
}

export function authHeadersNoContent(): HeadersInit {
  const token = localStorage.getItem("token");
  return {
    "Authorization": `Bearer ${token}`
  };
}