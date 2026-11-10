import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ORIGIN = "https://www.berriostreeservice.com";
const FALLBACK_PAGES = [
  "/",
  "/tree-service",
  "/tree-removal",
  "/stump-removal",
  "/contact",
  "/berrios-gallery",
];
const GTAG_SRC = "https://www.googletagmanager.com/gtag/js?id=G-FM8452YRQM";
const ASSET_URL_RE =
  /https?:\/\/(?:[a-z0-9.-]*website-files\.com|d3e54v103j8qbb\.cloudfront\.net)\/[^\s"'<>\\)]+/gi;

const pagePaths = new Map();
const assetPaths = new Map();
const assetBytes = new Map();

function pageFile(pathname) {
  if (pathname === "/") return "index.html";
  return `${pathname.replace(/^\/+|\/+$/g, "")}/index.html`;
}

function assetPublicPath(urlString) {
  const url = new URL(urlString);
  const base = decodeURIComponent(path.posix.basename(url.pathname));
  const ext = path.posix.extname(base).toLowerCase();
  const bucket = ext === ".css" ? "css" : ext === ".js" ? "js" : "images";
  const identity = `${url.hostname}${url.pathname}`;
  let name = base;
  const key = `${bucket}/${name}`;
  const previous = assetPaths.get(key);
  if (previous && previous !== identity) name = `${path.posix.basename(path.posix.dirname(url.pathname))}-${base}`;
  const publicPath = `/assets/${bucket}/${name}`;
  assetPaths.set(`${bucket}/${name}`, identity);
  assetPaths.set(identity, publicPath);
  return publicPath;
}

function localAssetPath(urlString) {
  const url = new URL(urlString);
  const identity = `${url.hostname}${url.pathname}`;
  return assetPaths.get(identity) ?? assetPublicPath(urlString);
}

async function fetchBuffer(url) {
  const response = await fetch(url, {
    headers: { "user-agent": "berrios-tree-service-scrape" },
    redirect: "follow",
    signal: AbortSignal.timeout(45000),
  });
  const bytes = Buffer.from(await response.arrayBuffer());
  return { status: response.status, bytes, finalUrl: response.url };
}

function extractAssetUrls(text) {
  return [...text.matchAll(ASSET_URL_RE)].map((match) => match[0].replace(/&amp;/g, "&"));
}

function rewriteAssets(text) {
  const urls = [...new Set(extractAssetUrls(text))].sort((a, b) => b.length - a.length);
  let out = text;
  for (const url of urls) {
    const local = localAssetPath(url);
    out = out.split(url).join(local);
    out = out.split(url.replace(/&/g, "&amp;")).join(local);
  }
  return out;
}

function rewriteHtml(html) {
  let out = html.replace(
    /<link\b[^>]*href="https:\/\/cdn\.prod\.website-files\.com"[^>]*>/gi,
    "",
  );
  out = out.replace(/<script\b[^>]*\bsrc="https:\/\/cdn\.logr-in\.com\/[^"]+"[^>]*>\s*<\/script>/gi, "");
  out = out.replace(/<script\b[^>]*>[^<]*LogRocket[^<]*<\/script>/gi, "");
  out = out.replace(/<!--\s*LogRocket[\s\S]*?-->/gi, "");
  out = out.replace(
    /<script\b[^>]*>[^<]*google_tags_first_party[^<]*<\/script>\s*/gi,
    "",
  );
  out = out.replace(/<script\b[^>]*\bsrc="(\/[^"]+)"[^>]*>\s*<\/script>/gi, (full, src) => {
    if (/\.[a-z0-9]+$/i.test(src.split("?")[0])) return full;
    return `<script async src="${GTAG_SRC}"></script>`;
  });
  out = rewriteAssets(out);
  // URL rewrites change CSS and some JS, so the CDN integrity hashes no longer match.
  out = out.replace(/<(link|script)\b[^>]*\b(?:href|src)="\/assets\/[^"]+"[^>]*>/gi, (tag) =>
    tag.replace(/\s+integrity="[^"]*"/gi, ""),
  );
  const footerPhone = "Hours of operation<br/>Monday-Saturday, 8:00 AM - 5:00 PM<br/>Phone:";
  const footerWithEmail = 'Hours of operation<br/>Monday-Saturday, 8:00 AM - 5:00 PM<br/>Email: <a href="mailto:berriostreesvc@gmail.com">berriostreesvc@gmail.com</a><br/>Phone:';
  if (out.includes(footerPhone) && !out.includes(footerWithEmail)) out = out.replace(footerPhone, footerWithEmail);
  if (out.includes('id="email-form"')) out = wireEstimateForm(out);
  return out;
}

function wireEstimateForm(html) {
  let out = html.replace(
    /<script\b[^>]*\bsrc="https:\/\/www\.google\.com\/recaptcha\/api\.js"[^>]*>\s*<\/script>/gi,
    "",
  );
  out = out.replace(/<div\b[^>]*class="[^"]*g-recaptcha[^"]*"[^>]*>\s*<\/div>/gi, "");
  out = out.replace(
    "Fill and submit form for a free estimate!",
    'Email us <a href="mailto:berriostreesvc@gmail.com">here</a> or fill out the form for your convenience. If you email, please include your name, email, phone number, and what you need (trim, removal, or stump grinding).',
  );
  if (!out.includes("/assets/js/estimate-form.js")) {
    out = out.replace(
      "</body>",
      '<script src="/assets/js/estimate-config.js"></script><script src="/assets/js/estimate-form.js"></script></body>',
    );
  }
  return out;
}

async function sitemapPaths() {
  try {
    const { status, bytes } = await fetchBuffer(`${ORIGIN}/sitemap.xml`);
    if (status !== 200) throw new Error(`sitemap status ${status}`);
    const xml = bytes.toString("utf8");
    const locs = [...xml.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)].map((match) => {
      const url = new URL(match[1].trim());
      const pathname = url.pathname.replace(/\/+$/, "") || "/";
      return pathname;
    });
    if (locs.length === 0) throw new Error("sitemap had no urls");
    return [...new Set([...FALLBACK_PAGES, ...locs])];
  } catch (error) {
    console.warn(`sitemap fallback: ${error.message}`);
    return [...FALLBACK_PAGES];
  }
}

async function main() {
  const pages = await sitemapPaths();
  console.log(`pages: ${pages.join(", ")}`);

  const htmlByFile = new Map();
  for (const pathname of pages) {
    const { status, bytes } = await fetchBuffer(new URL(pathname, ORIGIN));
    if (status !== 200) throw new Error(`${pathname} returned ${status}`);
    const file = pageFile(pathname);
    htmlByFile.set(file, bytes.toString("utf8"));
    pagePaths.set(pathname, file);
  }

  const missing = await fetchBuffer(`${ORIGIN}/this-page-does-not-exist`);
  if (missing.status !== 404) throw new Error(`404 probe returned ${missing.status}`);
  htmlByFile.set("404.html", missing.bytes.toString("utf8"));

  const pending = [];
  const seen = new Set();
  const queueAsset = (url) => {
    const clean = url.replace(/&amp;/g, "&");
    const identity = `${new URL(clean).hostname}${new URL(clean).pathname}`;
    if (seen.has(identity)) return;
    seen.add(identity);
    localAssetPath(clean);
    pending.push(clean);
  };

  for (const html of htmlByFile.values()) {
    for (const url of extractAssetUrls(html)) queueAsset(url);
  }

  const failures = [];
  let index = 0;
  async function downloadNext() {
    while (index < pending.length) {
      const url = pending[index];
      index += 1;
      const identity = `${new URL(url).hostname}${new URL(url).pathname}`;
      try {
        const { status, bytes } = await fetchBuffer(url);
        if (status !== 200 || bytes.length === 0) {
          failures.push(`${status} ${url}`);
          continue;
        }
        assetBytes.set(identity, bytes);
        const ext = path.posix.extname(new URL(url).pathname).toLowerCase();
        if (ext === ".css" || ext === ".js") {
          for (const nested of extractAssetUrls(bytes.toString("utf8"))) queueAsset(nested);
        }
      } catch (error) {
        failures.push(`${error.message} ${url}`);
      }
    }
  }
  await Promise.all(Array.from({ length: 8 }, downloadNext));

  if (failures.length) {
    console.error(failures.join("\n"));
    throw new Error(`${failures.length} asset downloads failed`);
  }

  for (const [file, html] of htmlByFile) {
    const target = path.join(ROOT, file);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, rewriteHtml(html));
  }

  for (const [identity, bytes] of assetBytes) {
    const publicPath = assetPaths.get(identity);
    const ext = path.posix.extname(publicPath).toLowerCase();
    const body = ext === ".css" || ext === ".js" ? rewriteAssets(bytes.toString("utf8")) : bytes;
    const target = path.join(ROOT, publicPath);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, body);
  }

  console.log(`wrote ${htmlByFile.size} html files and ${assetBytes.size} assets`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
