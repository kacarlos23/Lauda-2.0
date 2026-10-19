import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
import http from "node:http";
import https from "node:https";
import { URL } from "node:url";
import { setTimeout, clearTimeout } from "node:timers";

const blocked = new BlockList();
for (const [address, prefix] of [["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4]] as const) blocked.addSubnet(address, prefix, "ipv4");
const globalV6 = new BlockList();
globalV6.addSubnet("2000::", 3, "ipv6");
blocked.addSubnet("2001::", 23, "ipv6");
blocked.addSubnet("2001:db8::", 32, "ipv6");
blocked.addSubnet("2002::", 16, "ipv6");
export function publicImageAddress(address: string): boolean {
  const family = isIP(address);
  return family === 4 ? !blocked.check(address, "ipv4") : family === 6 && globalV6.check(address, "ipv6") && !blocked.check(address, "ipv6");
}

// Fetch only the registered public image. Pin DNS, reject redirects and bound time/size.
export async function loadPdfArtistImage(value: string): Promise<Buffer | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let request: http.ClientRequest | undefined;
  const controller = new AbortController();
  const deadline = new Promise<null>((resolve) => { timer = setTimeout(() => { controller.abort(); request?.destroy(); resolve(null); }, 2500); });
  const load = async (): Promise<Buffer | null> => {
    try {
      const url = new URL(value);
      if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.port) return null;
      const hostname = url.hostname.replace(/^\[|\]$/g, "");
      const addresses = isIP(hostname) ? [{ address: hostname, family: isIP(hostname) }] : await lookup(hostname, { all: true });
      if (controller.signal.aborted || !addresses.length || addresses.some(({ address }) => !publicImageAddress(address))) return null;
      const target = addresses[0]!;
      return await new Promise<Buffer | null>((resolve) => {
        request = (url.protocol === "https:" ? https : http).get(url, {
          signal: controller.signal, agent: false,
          lookup: (_host, options, callback) => options.all ? callback(null, [target]) : callback(null, target.address, target.family),
          headers: { Accept: "image/png,image/jpeg", "User-Agent": "Lauda-PDF" },
        }, (response) => {
          if (response.statusCode !== 200 || !/^image\/(png|jpe?g)(;|$)/i.test(response.headers["content-type"] ?? "")) { response.destroy(); resolve(null); return; }
          const chunks: Buffer[] = []; let size = 0;
          response.on("data", (chunk: Buffer) => {
            size += chunk.length;
            if (size > 1024 * 1024) { response.destroy(); resolve(null); } else chunks.push(chunk);
          });
          response.on("end", () => {
            const bytes = Buffer.concat(chunks);
            const png = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
            const jpeg = bytes[0] === 255 && bytes[1] === 216;
            resolve(png || jpeg ? bytes : null);
          });
          response.on("error", () => resolve(null));
        });
        request.on("error", () => resolve(null));
      });
    } catch { return null; }
  };
  try { return await Promise.race([load(), deadline]); } finally { clearTimeout(timer); }
}

export async function loadPdfArtistImages(urls: string[]): Promise<Map<string, Buffer>> {
  const unique = [...new Set(urls)];
  const images = new Map<string, Buffer>();
  const deadline = Date.now() + 7500;
  let index = 0, totalBytes = 0;
  await Promise.all(Array.from({ length: Math.min(4, unique.length) }, async () => {
    while (index < unique.length && Date.now() < deadline && totalBytes < 12 * 1024 * 1024) {
      const url = unique[index++]!;
      const image = await loadPdfArtistImage(url);
      if (image && totalBytes + image.length <= 12 * 1024 * 1024) { totalBytes += image.length; images.set(url, image); }
    }
  }));
  return images;
}
