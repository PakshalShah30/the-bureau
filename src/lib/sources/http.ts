/** Fetches official HTTPS endpoints only. Abort + size limits prevent hung/oversized refreshes. */
export async function sourceFetch(url: string, options: RequestInit = {}, limit = 35_000_000): Promise<Response> {
  const parsed = new URL(url);
  const hosts = ["boards-api.greenhouse.io", "api.lever.co", "api.ashbyhq.com", "apply.workable.com", "www.ycombinator.com", "45bwzj1sgc-dsn.algolia.net", "hacker-news.firebaseio.com", "hn.algolia.com"];
  if (parsed.protocol !== "https:" || !hosts.includes(parsed.hostname)) throw new Error("Only approved official sources are allowed");
  const response = await fetch(url, { ...options, redirect: "error", signal: AbortSignal.timeout(12000), cache: "no-store", headers: { "User-Agent": "TheBureau/1.0 (personal career tracker)", ...options.headers } });
  if (!response.ok) throw new Error(`${parsed.hostname}: HTTP ${response.status}`);
  if (Number(response.headers.get("content-length") || 0) > limit) throw new Error("Source response too large");
  return response;
}
export async function sourceJson<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await sourceFetch(url, options);
  const text = await response.text();
  if (text.length > 35_000_000) throw new Error("Source response too large");
  return JSON.parse(text) as T;
}
