import { STORE_SLUG } from "@/utils/string";

/**
 * Where a page goes when the API refused its visitor for asking too much
 * (its per-IP limit): a real 429 with Retry-After, which pages can't send
 * themselves. Customers rarely get here; scanners do. Plain HTML, nothing to
 * load, and it tries the page again by itself.
 */
export function GET(request: Request) {
  const back = new URL(request.url).searchParams.get("next");
  // Only a menu path of this site (it goes into the page as is).
  const target = back && STORE_SLUG.test(back.slice(1)) && back.startsWith("/") ? back : "/";
  const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="refresh" content="60;url=${target}">
<meta name="robots" content="noindex">
<title>Muitos acessos agora</title>
<style>
  body { font-family: system-ui, sans-serif; display: grid; place-items: center; min-height: 100svh; margin: 0; padding: 16px; box-sizing: border-box; color: #1c1917; background: #fafaf9; text-align: center; }
  @media (prefers-color-scheme: dark) { body { color: #f5f5f4; background: #1c1917; } a { color: #fdba74; } }
  h1 { font-size: 1.25rem; margin: 0 0 8px; }
  p { margin: 0 0 16px; max-width: 32rem; }
  a { color: #c2410c; font-weight: 600; }
</style>
</head>
<body>
<main>
<h1>Muitos acessos agora</h1>
<p>Recebemos muitos acessos deste endereço em pouco tempo. A página abre de novo sozinha em instantes.</p>
<a href="${target}">Tentar de novo</a>
</main>
</body>
</html>`;
  return new Response(html, {
    status: 429,
    headers: {
      "content-type": "text/html; charset=utf-8",
      // The API counts requests per minute.
      "retry-after": "60",
      "cache-control": "no-store",
      "x-robots-tag": "noindex",
    },
  });
}
