/**
 * Receives Content-Security-Policy violation reports (the policy is
 * Report-Only for now: lib/csp.ts) and logs one line each, so the policy can
 * be tightened and then enforced. Nothing is stored.
 */
export async function POST(request: Request) {
  const text = (await request.text()).slice(0, 4000);
  try {
    const body = JSON.parse(text) as Record<string, unknown> | Record<string, unknown>[];
    const reports = Array.isArray(body) ? body.map((entry) => entry.body ?? entry) : [body["csp-report"] ?? body];
    for (const report of reports as Record<string, unknown>[]) {
      console.warn(
        "csp-report",
        JSON.stringify({
          directive: report["effective-directive"] ?? report.effectiveDirective ?? report["violated-directive"],
          blocked: report["blocked-uri"] ?? report.blockedURL,
          page: report["document-uri"] ?? report.documentURL,
          source: report["source-file"] ?? report.sourceFile,
        }),
      );
    }
  } catch {
    // Not JSON: ignore.
  }
  return new Response(null, { status: 204 });
}
