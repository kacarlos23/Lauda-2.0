import { canonicalizeYouTubeUrl, extractYouTubeVideoId } from "../../utils/youtube";

describe("YouTube URL", () => {
  it.each([
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://youtu.be/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/shorts/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/embed/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://m.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/live/dQw4w9WgXcQ?feature=share", "dQw4w9WgXcQ"],
  ])("extrai o ID de %s", (url, expected) => {
    expect(extractYouTubeVideoId(url)).toBe(expected);
  });

  it.each([
    "https://example.com/youtube/dQw4w9WgXcQ",
    "https://youtube.example.com/watch?v=dQw4w9WgXcQ",
    "https://www.youtube.com/channel/qualquer-coisa",
    "https://www.youtube.com/playlist?list=PL123",
    "https://youtu.be/",
    "https://youtu.be/curto",
    "javascript:alert(1)",
    "não é uma URL",
    "",
  ])("rejeita %s", (url) => {
    expect(extractYouTubeVideoId(url)).toBeNull();
  });

  it("canonicaliza URLs reconhecidas", () => {
    expect(canonicalizeYouTubeUrl(" https://youtu.be/dQw4w9WgXcQ?t=10 "))
      .toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  });
});
