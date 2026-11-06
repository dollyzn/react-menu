import { registerOTel } from "@vercel/otel";
import type { Span, SpanProcessor } from "@opentelemetry/sdk-trace-base";

/** Attributes that hold a URL; tracking tokens and OAuth codes are masked in them. */
const URL_ATTRIBUTES = ["http.target", "http.url", "url.full", "url.path", "url.query", "next.span_name"];
const SECRET_QUERY_KEYS = ["token", "tokens", "code", "state", "vincular"];

/** `/pedido/<token>` and `/orders/<token>` keep their shape, not the token. */
export function redactUrl(url: string) {
  return url
    .replace(/\/(orders|pedido)\/[0-9a-f]{8}-[0-9a-f-]{27}/gi, "/$1/:token")
    .replace(new RegExp(`([?&](?:${SECRET_QUERY_KEYS.join("|")})=)[^&#\\s]*`, "gi"), "$1redacted");
}

/** Rewrites URL attributes as spans start (Next and fetch set them then). */
class RedactUrls implements SpanProcessor {
  onStart(span: Span) {
    for (const key of URL_ATTRIBUTES) {
      const value = span.attributes[key];
      if (typeof value === "string" && redactUrl(value) !== value) span.setAttribute(key, redactUrl(value));
    }
    if (redactUrl(span.name) !== span.name) span.updateName(redactUrl(span.name));
  }
  onEnd() {}
  async forceFlush() {}
  async shutdown() {}
}

/**
 * OpenTelemetry for the Next server (SSR, route handlers, server actions):
 * traces to the OTLP endpoint in OTEL_EXPORTER_OTLP_ENDPOINT (Grafana Cloud;
 * docs/development/observability.md), headers from OTEL_EXPORTER_OTLP_HEADERS,
 * sampling from OTEL_TRACES_SAMPLER(_ARG). Off without an endpoint
 * (development, CI, e2e).
 *
 * Calls to the API carry the trace context (traceparent), so a menu page
 * rendered on the server and the API queries behind it are one trace. Order
 * tracking tokens and OAuth codes are masked in recorded URLs.
 */
export function register() {
  if (!process.env.OTEL_EXPORTER_OTLP_ENDPOINT) return;

  // Origins with a trailing slash: "https://menu.example.com/" must not also
  // match "https://menu.example.com.evil.tld".
  const api = [process.env.API_INTERNAL_URL, process.env.NEXT_PUBLIC_API_URL]
    .filter((url): url is string => Boolean(url))
    .map((url) => `${new URL(url).origin}/`);

  registerOTel({
    serviceName: process.env.OTEL_SERVICE_NAME ?? "react-menu-web",
    attributes: {
      "service.version": process.env.NEXT_PUBLIC_BUILD_VERSION ?? "dev",
      "deployment.environment.name": process.env.APP_ENV ?? process.env.NODE_ENV ?? "development",
    },
    spanProcessors: [new RedactUrls(), "auto"],
    instrumentationConfig: {
      fetch: {
        // Only our API gets the trace context (never third parties).
        propagateContextUrls: api,
      },
    },
  });
}
