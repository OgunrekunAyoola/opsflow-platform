// ADR-T3: Per-agent tool contracts. Orchestrator validates ToolsHandle against these at startup.
import { resolutionContract } from '@opsflow/contracts';

export interface AgentContract {
  agent: string;
  allowedTools: string[];
}

// SINGLE SOURCE OF TRUTH (N-84 fix, 2026-06-23): the agents' capability scope is declared ONCE in
// @opsflow/contracts (the AgentLoop's guard). The runtime handle scope below DERIVES from it, so the
// two lists can never drift. Only the non-agent pipeline nodes (RAGNode, EnrichmentAgentNode, the
// router, EscalationNode) carry their own minimal scope here — they have no @opsflow/contracts
// AgentContract. refund_order/create_order stay excluded everywhere (humanOnly=true; ADR-068 / HITL).
export const AGENT_CONTRACTS: AgentContract[] = [
  { agent: 'TriageAgentNode', allowedTools: [] },
  { agent: 'EnrichmentAgentNode', allowedTools: [] },
  { agent: 'RAGNode', allowedTools: ['kb_lookup'] },
  { agent: 'TriageRouterAgent', allowedTools: [] },
  // Derived from @opsflow/contracts resolutionContract.allowedTools — the one source of truth.
  { agent: 'ResolutionAgentNode', allowedTools: [...resolutionContract.allowedTools] },
  { agent: 'ResponseAgentNode', allowedTools: [] },
  { agent: 'QualityAgentNode', allowedTools: [] },
  { agent: 'EscalationNode', allowedTools: ['escalate_ticket'] },
  { agent: 'MemoryAgentNode', allowedTools: [] },
];

export function getContractFor(agent: string): AgentContract {
  return AGENT_CONTRACTS.find((c) => c.agent === agent) ?? { agent, allowedTools: [] };
}

/** Throws at startup if any agent's contract references a tool not in the registry. */
export function validateContractsAgainstRegistry(registeredTools: string[]): void {
  const registered = new Set(registeredTools);
  for (const contract of AGENT_CONTRACTS) {
    for (const tool of contract.allowedTools) {
      if (!registered.has(tool) && tool !== 'kb_lookup') {
        throw new Error(
          `ADR-T3 contract violation: agent "${contract.agent}" declares tool "${tool}" which is not registered`,
        );
      }
    }
  }
}
