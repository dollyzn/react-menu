import { registerOTel } from "@vercel/otel";

/**
 * OpenTelemetry for the Next server (SSR, route handlers, server actions):
 * traces to the OTLP endpoint in OTEL_EXPORTER_OTLP_ENDPOINT (Grafana Cloud;
 * docs/development/observability.md), headers from OTEL_EXPORTER_OTLP_HEADERS.
 * Off without an endpoint (development, CI, e2e).
 *
 * Calls to the API carry the trace context (traceparent), so a menu page
 * rendered on the server and the API queries behind it are one trace.
 */
export function register() {
  if (!process.env.OTEL_EXPORTER_OTLP_ENDPOINT) return;

  const api = [process.env.API_INTERNAL_URL, process.env.NEXT_PUBLIC_API_URL]
    .filter((url): url is string => Boolean(url))
    .map((url) => new URL(url).origin);

  registerOTel({
    serviceName: process.env.OTEL_SERVICE_NAME ?? "react-menu-web",
    attributes: {
      "service.version": process.env.NEXT_PUBLIC_BUILD_VERSION ?? "dev",
      "deployment.environment.name": process.env.APP_ENV ?? process.env.NODE_ENV ?? "development",
    },
    instrumentationConfig: {
      fetch: {
        // Only our API gets the trace context (never third parties).
        propagateContextUrls: api,
      },
    },
  });
}
