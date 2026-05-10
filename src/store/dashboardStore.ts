import { create } from 'zustand'

export type AgentStatus = 'online' | 'busy' | 'offline' | 'error'

export interface Agent {
  id: string
  name: string
  slug: string
  category: string
  icon: string
  description: string
  status: AgentStatus
  enabled: boolean
  model: string
  totalTokens: number
  totalCost: number
  lastActive: string | null
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  agentSlug: string
  timestamp: string
  tokens?: number
}

export interface MetricEntry {
  date: string
  tokens: number
  cost: number
  requests: number
  agentSlug: string
}

export interface LogEntry {
  id: string
  timestamp: string
  level: 'info' | 'warn' | 'error' | 'success'
  agentSlug: string
  action: string
  detail: string
  durationMs?: number
}

export interface Notification {
  id: string
  message: string
  type: 'info' | 'success' | 'warn' | 'error'
  timestamp: string
  read: boolean
}

interface DashboardState {
  // Agents
  agents: Agent[]
  setAgents: (agents: Agent[]) => void
  toggleAgent: (id: string) => void
  updateAgentStatus: (slug: string, status: AgentStatus) => void

  // Chat
  activeAgentSlug: string | null
  chatHistories: Record<string, ChatMessage[]>
  isTyping: boolean
  setActiveAgent: (slug: string | null) => void
  addMessage: (msg: ChatMessage) => void
  setHistory: (slug: string, messages: ChatMessage[]) => void
  setTyping: (v: boolean) => void

  // Metrics
  metrics: MetricEntry[]
  globalMetrics: { totalTokens: number; totalCost: number; totalRequests: number; activeAgents: number }
  addMetricEntry: (entry: MetricEntry) => void

  // Logs
  logs: LogEntry[]
  pushLog: (log: LogEntry) => void

  // Notifications
  notifications: Notification[]
  pushNotification: (n: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void
  markAllRead: () => void
  clearNotifications: () => void
}

export const useDashboard = create<DashboardState>((set) => ({
  // ── Agents ──────────────────────────────────────────────────────────────
  agents: [],
  setAgents: (agents) => set({ agents }),
  toggleAgent: (id) =>
    set(s => ({
      agents: s.agents.map(a => a.id === id ? { ...a, enabled: !a.enabled } : a),
    })),
  updateAgentStatus: (slug, status) =>
    set(s => ({
      agents: s.agents.map(a => a.slug === slug ? { ...a, status } : a),
    })),

  // ── Chat ────────────────────────────────────────────────────────────────
  activeAgentSlug: null,
  chatHistories: {},
  isTyping: false,
  setActiveAgent: (slug) => set({ activeAgentSlug: slug }),
  addMessage: (msg) =>
    set(s => ({
      chatHistories: {
        ...s.chatHistories,
        [msg.agentSlug]: [...(s.chatHistories[msg.agentSlug] ?? []), msg],
      },
    })),
  setHistory: (slug, messages) =>
    set(s => ({
      chatHistories: { ...s.chatHistories, [slug]: messages },
    })),
  setTyping: (v) => set({ isTyping: v }),

  // ── Metrics ─────────────────────────────────────────────────────────────
  metrics: [],
  globalMetrics: { totalTokens: 0, totalCost: 0, totalRequests: 0, activeAgents: 0 },
  addMetricEntry: (entry) =>
    set(s => ({
      metrics: [...s.metrics, entry],
      globalMetrics: {
        totalTokens:   s.globalMetrics.totalTokens   + entry.tokens,
        totalCost:     s.globalMetrics.totalCost     + entry.cost,
        totalRequests: s.globalMetrics.totalRequests + entry.requests,
        activeAgents:  s.agents.filter(a => a.enabled).length,
      },
    })),

  // ── Logs ────────────────────────────────────────────────────────────────
  logs: [],
  pushLog: (log) =>
    set(s => ({ logs: [log, ...s.logs].slice(0, 500) })),

  // ── Notifications ───────────────────────────────────────────────────────
  notifications: [],
  pushNotification: (n) =>
    set(s => ({
      notifications: [
        { ...n, id: crypto.randomUUID(), timestamp: new Date().toISOString(), read: false },
        ...s.notifications,
      ].slice(0, 50),
    })),
  markAllRead: () =>
    set(s => ({ notifications: s.notifications.map(n => ({ ...n, read: true })) })),
  clearNotifications: () => set({ notifications: [] }),
}))
