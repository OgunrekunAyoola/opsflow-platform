// ADR-T3: Per-agent tool contracts. Orchestrator validates ToolsHandle against these at startup.

export interface AgentContract {
  agent: string;
  allowedTools: string[];
}

export const AGENT_CONTRACTS: AgentContract[] = [
  { agent: 'TriageAgentNode', allowedTools: [] },
  { agent: 'EnrichmentAgentNode', allowedTools: [] },
  { agent: 'RAGNode', allowedTools: ['kb_lookup'] },
  { agent: 'TriageRouterAgent', allowedTools: [] },
  // refund_order intentionally excluded: humanOnly=true (ADR-068).
  // Payment refunds require human authorization + payment gateway webhook.
  {
    agent: 'ResolutionAgentNode',
    allowedTools: [
      'kb_lookup',
      'escalate_ticket',
      'check_order_status',
      'reset_password',
      'get_customer_orders',
      'product_lookup',
      'check_inventory',
      'update_delivery_address',
      'add_order_note',
      // Conversion (CONVERSION_CAPABILITY_DESIGN) — must mirror @opsflow/contracts
      // resolutionContract.allowedTools (the AgentLoop's capability guard).
      'create_order',
    ],
  },
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
