'use client'
import { usePresence } from '@/hooks/usePresence'

export function PresenceTracker() {
  usePresence()
  return null
}