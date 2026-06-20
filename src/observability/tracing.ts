import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';

let sdk: NodeSDK | null = null;

/**
 * Initialise OpenTelemetry SDK. Call this ONCE, before any other imports.
 * In production, traces are exported to the OTLP collector at OTLP_ENDPOINT.
 * When OTLP_ENDPOINT is not set, the SDK runs with no-op exporters (safe for dev/test).
 */
export function initTracing(): void {
  const endpoint = process.env.OTLP_ENDPOINT;

  sdk = new NodeSDK({
    serviceName: process.env.OTEL_SERVICE_NAME ?? 'opsflow-backend',
    traceExporter: endpoint ? new OTLPTraceExporter({ url: endpoint }) : undefined,
    instrumentations: [
      getNodeAutoInstrumentations({
        // Disable noisy fs instrumentation
        '@opentelemetry/instrumentation-fs': { enabled: false },
      }),
    ],
  });

  sdk.start();

  process.on('SIGTERM', () => sdk?.shutdown());
  process.on('SIGINT',  () => sdk?.shutdown());
}
