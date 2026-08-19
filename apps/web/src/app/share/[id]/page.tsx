'use client'

import { use } from 'react'
import SharePage from '../../../components/SharePage'

export default function ShareRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return <SharePage token={id} />
}
