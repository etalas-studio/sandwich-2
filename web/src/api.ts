export async function api<T>(path: string, method?: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: method ?? "GET",
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    const message =
      data && typeof data === "object" && "error" in data && typeof (data as { error: unknown }).error === "string"
        ? (data as { error: string }).error
        : `HTTP ${String(res.status)}`;
    throw new Error(message);
  }
  return data as T;
}
