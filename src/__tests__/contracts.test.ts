/**
 * ADR-T3 / N-84 — the runtime tool-handle scope (AGENT_CONTRACTS) is DERIVED from the agents'
 * @opsflow/contracts capability scope, so the two lists cannot drift. These tests lock that wiring:
 * if someone re-hardcodes the platform list, the deep-equal fails; if a money/humanOnly tool ever
 * leaks into the agent scope (SOC #6, ADR-068), the exclusion test fails.
 */
import { resolutionContract } from '@opsflow/contracts';
import { AGENT_CONTRACTS, getContractFor } from '../tools/contracts';

describe('AGENT_CONTRACTS ↔ @opsflow/contracts (single source of truth)', () => {
  it('ResolutionAgentNode runtime scope is exactly the resolution contract scope', () => {
    expect(getContractFor('ResolutionAgentNode').allowedTools).toEqual([...resolutionContract.allowedTools]);
  });

  it('derives a fresh array (no shared mutable reference to the contract)', () => {
    expect(getContractFor('ResolutionAgentNode').allowedTools).not.toBe(resolutionContract.allowedTools);
  });

  // SOC #6 / ADR-068: a humanOnly tool may never appear in any agent's scope.
  it('no agent scope contains a humanOnly tool (refund_order, create_order)', () => {
    for (const contract of AGENT_CONTRACTS) {
      expect(contract.allowedTools).not.toContain('refund_order');
      expect(contract.allowedTools).not.toContain('create_order');
    }
  });

  it('payment_link stays in the resolution scope (generates a link, never confirms payment)', () => {
    expect(getContractFor('ResolutionAgentNode').allowedTools).toContain('payment_link');
  });

  it('unknown agent yields an empty scope (deny by default)', () => {
    expect(getContractFor('NoSuchNode').allowedTools).toEqual([]);
  });
});
