import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const html = await readFile(resolve(root, "site/index.html"));
const worker = await readFile(resolve(root, "worker/index.js"), "utf8");
if (!worker.includes("__PAGE_BASE64__")) throw new Error("Worker page placeholder is missing.");
const rendered = worker.replace("__PAGE_BASE64__", html.toString("base64"));
const dist = resolve(root, "dist");
await rm(dist, { recursive: true, force: true });
await mkdir(resolve(dist, "server"), { recursive: true });
await mkdir(resolve(dist, ".openai"), { recursive: true });
await writeFile(resolve(dist, "server/index.js"), rendered);
await writeFile(resolve(dist, ".openai/hosting.json"), await readFile(resolve(root, ".openai/hosting.json")));
await cp(resolve(root, "drizzle"), resolve(dist, ".openai/drizzle"), { recursive: true });
console.log(`Built Aapurti Worker in ${dist}`);
