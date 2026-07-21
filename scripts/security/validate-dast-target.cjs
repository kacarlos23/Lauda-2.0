const required = ["STAGING_BASE_URL", "DAST_ALLOWED_HOSTS", "SYNTHETIC_DATASET_ID", "STAGING_PRODUCTION_DATA", "STAGING_DAST_TOKEN"];
for (const name of required) if (!process.env[name]) throw new Error(`${name} is required`);

const target = new URL(process.env.STAGING_BASE_URL);
const allowedHosts = process.env.DAST_ALLOWED_HOSTS.split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
const loopback = ["localhost", "127.0.0.1", "::1"].includes(target.hostname.toLowerCase());
if (target.protocol !== "https:" && !(loopback && process.env.DAST_ALLOW_HTTP_LOOPBACK === "true")) {
  throw new Error("DAST target must use HTTPS (HTTP is allowed only for an explicitly enabled loopback target)");
}
if (target.username || target.password) throw new Error("Credentials must not be embedded in STAGING_BASE_URL");
if (!allowedHosts.includes(target.hostname.toLowerCase())) throw new Error("DAST target host is not present in DAST_ALLOWED_HOSTS");
if (!process.env.SYNTHETIC_DATASET_ID.startsWith("synthetic-")) throw new Error("SYNTHETIC_DATASET_ID must identify a synthetic dataset");
if (process.env.STAGING_PRODUCTION_DATA !== "false") throw new Error("DAST is forbidden when production data is present");
if (process.env.STAGING_DAST_TOKEN.length < 20) throw new Error("STAGING_DAST_TOKEN is missing or too short for authenticated coverage");

console.log(JSON.stringify({ target_origin: target.origin, dataset: process.env.SYNTHETIC_DATASET_ID, production_data: false }));
