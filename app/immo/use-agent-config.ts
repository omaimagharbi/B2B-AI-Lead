'use client'

import { useEffect, useState } from 'react'
import { useImmo } from '@/lib/immo-os/store'
import { DEFAULT_AGENT_CONFIG, readConfig, type AgentConfig } from '@/lib/immo-os/ai-agent'

// Reglages de l'agent IA de l'agence (interrupteurs) : base reelle en mode live, navigateur en mode demo.
export function useAgentConfig(): AgentConfig {
  const { mode, callApi } = useImmo()
  const [cfg, setCfg] = useState<AgentConfig>(DEFAULT_AGENT_CONFIG)
  useEffect(() => {
    if (mode === 'demo') { try { setCfg(readConfig(JSON.parse(localStorage.getItem('imo_ai_agent') ?? '{}'))) } catch {} ; return }
    if (mode === 'live') callApi('/api/immo?r=settings').then((r) => { if (r.ok) setCfg(readConfig(r.json.ai_agent)) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])
  return cfg
}
