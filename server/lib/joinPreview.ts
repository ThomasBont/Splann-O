import fs from "fs/promises";
import path from "path";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function upsertMetaTag(html: string, matcher: RegExp, tag: string): string {
  if (matcher.test(html)) {
    return html.replace(matcher, tag);
  }
  return html.replace("</head>", `  ${tag}\n  </head>`);
}

export async function loadJoinPreviewTemplate() {
  const isProd = process.env.NODE_ENV === "production";
  const templatePath = isProd
    ? path.resolve(process.cwd(), "dist/public/index.html")
    : path.resolve(process.cwd(), "client/index.html");
  return fs.readFile(templatePath, "utf8");
}

export function renderJoinPreviewHtml(
  template: string,
  input: {
    title: string;
    description: string;
    imageUrl: string;
    url: string;
    siteName?: string;
  },
) {
  const title = escapeHtml(input.title);
  const description = escapeHtml(input.description);
  const imageUrl = escapeHtml(input.imageUrl);
  const url = escapeHtml(input.url);
  const siteName = escapeHtml(input.siteName ?? "Splann-O");

  let html = template;
  html = html.replace(/<title>.*?<\/title>/i, `<title>${title}</title>`);
  html = upsertMetaTag(html, /<link\s+rel="canonical"[^>]*>/i, `<link rel="canonical" href="${url}" />`);
  html = upsertMetaTag(html, /<meta\s+name="description"[^>]*>/i, `<meta name="description" content="${description}" />`);
  html = upsertMetaTag(html, /<meta\s+property="og:title"[^>]*>/i, `<meta property="og:title" content="${title}" />`);
  html = upsertMetaTag(html, /<meta\s+property="og:description"[^>]*>/i, `<meta property="og:description" content="${description}" />`);
  html = upsertMetaTag(html, /<meta\s+property="og:image"[^>]*>/i, `<meta property="og:image" content="${imageUrl}" />`);
  html = upsertMetaTag(html, /<meta\s+property="og:url"[^>]*>/i, `<meta property="og:url" content="${url}" />`);
  html = upsertMetaTag(html, /<meta\s+property="og:site_name"[^>]*>/i, `<meta property="og:site_name" content="${siteName}" />`);
  html = upsertMetaTag(html, /<meta\s+property="og:type"[^>]*>/i, `<meta property="og:type" content="website" />`);
  html = upsertMetaTag(html, /<meta\s+name="twitter:card"[^>]*>/i, `<meta name="twitter:card" content="summary_large_image" />`);
  return html;
}
