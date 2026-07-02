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

  // Communication-only scope (money cleanup): OpsFlow has NO money capability — payment_link and every
  // other money/order tool were removed. The assistant defers money to the vendor, it never transacts.
  it('no money/order tool is in the resolution scope (payment_link removed — communication-only)', () => {
    const scope = getContractFor('ResolutionAgentNode').allowedTools;
    for (const money of ['payment_link', 'create_order', 'refund_order', 'check_order_status']) {
      expect(scope).not.toContain(money);
    }
  });

  it('unknown agent yields an empty scope (deny by default)', () => {
    expect(getContractFor('NoSuchNode').allowedTools).toEqual([]);
  });
});
