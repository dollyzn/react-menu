import { fetchMenu } from "../../_lib/fetch-menu";
import { customerManifest } from "@/lib/pwa-manifest";

/** Customer app of one store (/<slug>): its name and logo on the home screen. */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await fetchMenu(slug, { track: false })
    .then((menu) => menu?.store ?? null)
    .catch(() => null);
  if (!store) return new Response("Not found", { status: 404 });

  return Response.json(customerManifest(store, { path: `/${slug}` }), {
    headers: { "content-type": "application/manifest+json", "cache-control": "public, max-age=3600" },
  });
}
