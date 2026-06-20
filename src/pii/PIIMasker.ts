import { randomUUID } from 'crypto';
import { getRedisClient } from '../infra/redis';
import logger from '../shared/utils/logger';

async function fetchJSON(url: string, body: unknown): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Presidio ${res.status}`);
    return res.json();
  } finally {
    clearTimeout(timer);
  }
}

const ANALYZER_URL = process.env.PRESIDIO_ANALYZER_URL || 'http://localhost:5002';
const ANONYMIZER_URL = process.env.PRESIDIO_ANONYMIZER_URL || 'http://localhost:5001';
const REVERSAL_TTL_SECONDS = 24 * 60 * 60; // 24 h — matches ticket resolution window

export interface MaskResult {
  masked: string;
  reversalId: string;
  /** true when Presidio was down and the coarse local fallback masker was used */
  degraded?: boolean;
}

/**
 * Thrown when no masking tier could run (S-01 / ADR-029 fail-closed decision
 * 2026-06-12: raw PII never egresses to a cloud LLM provider). Providers let
 * this propagate, which blocks the LLM call; the pipeline's escalation path
 * then routes the ticket to a human.
 */
export class PIIMaskingUnavailableError extends Error {
  constructor(cause: string) {
    super(`PII masking unavailable — refusing to send text to LLM provider (${cause})`);
    this.name = 'PIIMaskingUnavailableError';
  }
}

// ── Local fallback masker ─────────────────────────────────────────────────────
// Deterministic, coarse tier used when Presidio is unreachable. It cannot catch
// names/addresses the way Presidio does, so it deliberately over-masks digit
// runs: a false <NUMBER> degrades answer quality; a leaked BVN violates NDPC.
const FALLBACK_PATTERNS: Array<[RegExp, string]> = [
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '<EMAIL>'],
  [/\b\d(?:[ -]?\d){12,18}\b/g, '<CARD>'],
  [/(?:\+?234|\b0)[789][01]\d{8}\b/g, '<PHONE>'],
  [/\+\d{7,15}\b/g, '<PHONE>'],
  [/\b\d{10,12}\b/g, '<NUMBER>'],
];

export function localFallbackMask(text: string): string {
  let masked = text;
  for (const [pattern, replacement] of FALLBACK_PATTERNS) {
    masked = masked.replace(pattern, replacement);
  }
  return masked;
}

// In-memory fallback when Redis is unavailable (dev/test)
const memStore = new Map<string, string>();

export class PIIMasker {
  async mask(text: string, language = 'en'): Promise<MaskResult> {
    if (!text?.trim()) {
      return { masked: text, reversalId: '' };
    }

    let masked = text;
    let degraded = false;

    try {
      const analyzeRes = await fetchJSON(`${ANALYZER_URL}/analyze`, { text, language });
      const entities: any[] = analyzeRes ?? [];

      if (entities.length === 0) {
        return { masked: text, reversalId: '' };
      }

      const anonymizeRes = await fetchJSON(`${ANONYMIZER_URL}/anonymize`, {
        text,
        analyzer_results: entities,
        anonymizers: {},
      });

      masked = anonymizeRes?.text ?? text;
    } catch (err: any) {
      // S-01 fail-closed (decision 2026-06-12): NEVER pass raw text through.
      try {
        masked = localFallbackMask(text);
        degraded = true;
        logger.error(
          { event: 'pii_presidio_unavailable', err: err?.message },
          '[PIIMasker] Presidio unavailable — local fallback masker applied (degraded masking, ADR-029)',
        );
      } catch (fallbackErr: any) {
        logger.error(
          { event: 'pii_masking_unavailable', err: fallbackErr?.message },
          '[PIIMasker] All masking tiers failed — blocking LLM-bound text (ADR-029 fail-closed)',
        );
        throw new PIIMaskingUnavailableError(fallbackErr?.message ?? 'fallback masker failed');
      }
    }

    const reversalId = randomUUID();
    await this._store(reversalId, text);

    return { masked, reversalId, degraded };
  }

  async unmask(reversalId: string): Promise<string | null> {
    if (!reversalId) return null;
    return this._retrieve(reversalId);
  }

  private async _store(reversalId: string, original: string): Promise<void> {
    const redis = getRedisClient();
    if (redis) {
      await redis.setex(`pii:reversal:${reversalId}`, REVERSAL_TTL_SECONDS, original);
    } else {
      memStore.set(reversalId, original);
    }
  }

  private async _retrieve(reversalId: string): Promise<string | null> {
    const redis = getRedisClient();
    if (redis) {
      return redis.get(`pii:reversal:${reversalId}`);
    }
    return memStore.get(reversalId) ?? null;
  }
}

export const piiMasker = new PIIMasker();
