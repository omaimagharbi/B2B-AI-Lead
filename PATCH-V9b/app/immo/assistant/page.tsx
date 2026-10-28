'use client'

import { Bot } from 'lucide-react'
import { PageHead } from '@/lib/immo-os/ui'
import AssistantChat from '../assistant-chat'

export default function AssistantPage() {
  return (
    <div>
      <PageHead icon={<Bot size={28} />} title="AI Assistant" sub="Search listings in plain English, analyze the market, write ads, draft replies and generate reports" />
      <AssistantChat />
    </div>
  )
}
