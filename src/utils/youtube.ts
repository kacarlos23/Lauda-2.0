const YOUTUBE_VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
]);

const SHORT_YOUTUBE_HOSTS = new Set(["youtu.be", "www.youtu.be"]);

function validVideoId(value: string | null | undefined): string | null {
  return value && YOUTUBE_VIDEO_ID_PATTERN.test(value) ? value : null;
}

export function extractYouTubeVideoId(value: string): string | null {
  if (typeof value !== "string") return null;

  try {
    const url = new URL(value.trim());
    const host = url.hostname.toLowerCase();

    if ((url.protocol !== "https:" && url.protocol !== "http:") || url.username || url.password) return null;

    const pathSegments = url.pathname.split("/").filter(Boolean);

    if (SHORT_YOUTUBE_HOSTS.has(host)) {
      return pathSegments.length === 1 ? validVideoId(pathSegments[0]) : null;
    }

    if (!YOUTUBE_HOSTS.has(host)) return null;

    if (url.pathname === "/watch") return validVideoId(url.searchParams.get("v"));

    if (
      pathSegments.length === 2
      && ["embed", "shorts", "live"].includes(pathSegments[0])
    ) {
      return validVideoId(pathSegments[1]);
    }

    return null;
  } catch {
    return null;
  }
}

export function canonicalizeYouTubeUrl(value: string): string | null {
  const videoId = extractYouTubeVideoId(value);
  return videoId ? `https://www.youtube.com/watch?v=${videoId}` : null;
}
