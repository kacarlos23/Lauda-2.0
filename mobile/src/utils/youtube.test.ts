import {
  buildYouTubeEmbedUrl,
  canonicalizeYouTubeUrl,
  extractYouTubeVideoId,
  isAllowedYouTubePlayerNavigation,
} from "./youtube";

describe("YouTube URL", () => {
  it.each([
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://youtu.be/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/shorts/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/embed/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://m.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/live/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
  ])("extrai o ID de %s", (url, expected) => {
    expect(extractYouTubeVideoId(url)).toBe(expected);
  });

  it.each([
    "https://example.com/youtube/dQw4w9WgXcQ",
    "https://youtube.example.com/watch?v=dQw4w9WgXcQ",
    "https://www.youtube.com/channel/qualquer-coisa",
    "https://www.youtube.com/playlist?list=PL123",
    "https://youtu.be/curto",
    "javascript:alert(1)",
    "",
  ])("rejeita %s", (url) => {
    expect(extractYouTubeVideoId(url)).toBeNull();
  });

  it("gera somente URLs controladas a partir do ID validado", () => {
    expect(canonicalizeYouTubeUrl("https://youtu.be/dQw4w9WgXcQ"))
      .toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(buildYouTubeEmbedUrl("dQw4w9WgXcQ"))
      .toBe("https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1&playsinline=1");
    expect(() => buildYouTubeEmbedUrl("inválido")).toThrow("ID de vídeo do YouTube inválido");
  });

  it("restringe a navegação nativa ao embed do vídeo reconhecido", () => {
    expect(isAllowedYouTubePlayerNavigation("about:blank", "dQw4w9WgXcQ")).toBe(true);
    expect(isAllowedYouTubePlayerNavigation(
      "https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1",
      "dQw4w9WgXcQ"
    )).toBe(true);
    expect(isAllowedYouTubePlayerNavigation(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "dQw4w9WgXcQ"
    )).toBe(false);
    expect(isAllowedYouTubePlayerNavigation("https://example.com", "dQw4w9WgXcQ")).toBe(false);
  });
});
