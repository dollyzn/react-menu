import { z } from "zod";

/**
 * Zod 4 probes `Function("")` to compile faster validators; the
 * Content-Security-Policy has no 'unsafe-eval' (lib/csp.ts), so the probe
 * only produced violation reports on every page. Imported once by the root
 * providers, before any schema runs.
 */
z.config({ jitless: true });
