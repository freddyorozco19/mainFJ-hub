import { useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDashboard } from '../store/dashboardStore'

export function KRONOS() {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const navigate = useNavigate()
  const agents = useDashboard(s => s.agents)

  // Handle navigation requests from iframe
  const handleMessage = useCallback((e: MessageEvent) => {
    if (!e.data || typeof e.data !== 'object') return
    const { type, route } = e.data

    if (type === 'navigate' && route && iframeRef.current?.contentWindow === e.source) {
      // Check if internal route
      try {
        const url = new URL(route)
        // If same origin, use React Router
        if (url.host === window.location.host) {
          navigate(url.pathname)
        } else {
          window.open(route, '_blank', 'noopener')
        }
      } catch {
        // Relative path, use React Router
        navigate(route)
      }
    }

    if (type === 'ready' && iframeRef.current?.contentWindow === e.source) {
      // KRONOS is loaded, send initial state
      sendState()
    }
  }, [navigate])

  const sendState = useCallback(() => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage({
        type: 'state',
        data: { agents },
      }, '*')
    }
  }, [agents])

  useEffect(() => {
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [handleMessage])

  // Send state updates when agents change
  useEffect(() => {
    if (iframeRef.current?.contentWindow) {
      sendState()
    }
  }, [agents, sendState])

  return (
    <iframe
      ref={iframeRef}
      src="/kronos.html"
      title="KRONOS Multi-Agent System"
      style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
    />
  )
}
