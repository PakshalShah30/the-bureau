export async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...options, headers: { ...(options?.body instanceof FormData ? {} : { "Content-Type": "application/json" }), ...options?.headers }, cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data as T;
}
export function initials(value: string) { return value.split(/\s+/).map(v => v[0]).slice(0, 2).join("").toUpperCase(); }
export function companyColors(value: string) {
  const palettes = [["#eeeaff", "#6753c7"], ["#def5ed", "#217c59"], ["#e7f0ff", "#386ba9"], ["#fff0e5", "#b86b35"], ["#fdebf0", "#ab5070"], ["#edf1f9", "#495a7d"]];
  return palettes[[...value].reduce((n, c) => n + c.charCodeAt(0), 0) % palettes.length];
}
