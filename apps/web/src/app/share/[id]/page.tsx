'use client'

import SharePage from '../../../components/SharePage'

export default function ShareRoute({ params }: { params: { id: string } }) {
  return <SharePage token={params.id} />
}
