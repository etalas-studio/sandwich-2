import { useState, useEffect, useRef, useCallback } from 'react'
import { apiUrl } from '../api/base'
import type { Ticket } from '../api/tickets'

interface TicketRunState {
  ticket: Ticket | null
  isRunning: boolean
  currentStage: string | null
}

export function useTicketRun(ticket: Ticket | null): TicketRunState {
  const [currentTicket, setCurrentTicket] = useState<Ticket | null>(ticket)
  const [isRunning, setIsRunning] = useState(false)
  const [currentStage, setCurrentStage] = useState<string | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)
  const keyRef = useRef<string | null>(null)

  // Sync when selected ticket changes
  useEffect(() => {
    setCurrentTicket(ticket)
    setCurrentStage(null)

    if (ticket?.status === 'in_progress') {
      setIsRunning(true)
      setCurrentStage(ticket.stage)
    } else {
      setIsRunning(false)
    }
  }, [ticket?.key, ticket?.status, ticket?.stage])

  const connect = useCallback((ticketKey: string) => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }

    const es = new EventSource(apiUrl(`/api/tickets/${encodeURIComponent(ticketKey)}/stream`))
    eventSourceRef.current = es
    keyRef.current = ticketKey

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as {
          type: string
          ticket?: Ticket
          stage?: string
        }

        switch (data.type) {
          case 'current':
          case 'stage_start':
          case 'stage_end':
            if (data.ticket) {
              setCurrentTicket(data.ticket)
              setIsRunning(data.ticket.status === 'in_progress')
              setCurrentStage(data.ticket.stage)
            }
            break
          case 'done':
            if (data.ticket) {
              setCurrentTicket(data.ticket)
              setIsRunning(false)
              setCurrentStage(null)
            }
            es.close()
            break
          case 'error':
            setIsRunning(false)
            es.close()
            break
        }
      } catch {
        // ignore parse errors
      }
    }

    es.onerror = () => {
      setIsRunning(false)
      es.close()
    }
  }, [])

  useEffect(() => {
    if (ticket && ticket.status === 'in_progress') {
      connect(ticket.key)
    }

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
    }
  }, [ticket?.key, ticket?.status === 'in_progress' ? ticket.status : null])

  return { ticket: currentTicket, isRunning, currentStage }
}
