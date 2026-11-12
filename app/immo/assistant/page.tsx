'use client'

import { Bot } from 'lucide-react'
import { PageHead } from '@/lib/immo-os/ui'
import { useImmo } from '@/lib/immo-os/store'
import AssistantChat from '../assistant-chat'

export default function AssistantPage() {
  const { t } = useImmo()
  return (
    <div>
      <PageHead icon={<Bot size={28} />} title={t('nav.assistant')} sub={t('xm.assistant_sub')} />
      <AssistantChat />
    </div>
  )
}
