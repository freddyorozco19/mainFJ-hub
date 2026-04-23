# -*- coding: utf-8 -*-
"""SSE Event Manager — broadcast events to connected clients."""
from __future__ import annotations
import asyncio
import json
from datetime import datetime
from typing import Any


class EventManager:
    """Manages SSE connections and broadcasts events to all subscribers."""

    def __init__(self):
        self._subscribers: list[asyncio.Queue] = []

    async def subscribe(self) -> asyncio.Queue:
        """Return a new queue for this subscriber."""
        q: asyncio.Queue = asyncio.Queue()
        self._subscribers.append(q)
        return q

    def unsubscribe(self, q: asyncio.Queue):
        """Remove a subscriber."""
        try:
            self._subscribers.remove(q)
        except ValueError:
            pass

    async def publish(self, event: str, data: dict[str, Any]):
        """Broadcast an event to all connected subscribers."""
        payload = json.dumps({
            "event": event,
            "data": data,
            "timestamp": datetime.now().isoformat(),
        }, ensure_ascii=False)
        for q in list(self._subscribers):
            try:
                q.put_nowait(payload)
            except asyncio.QueueFull:
                pass

    # ── Convenience emitters ──────────────────────────────────────────

    async def agent_status(self, slug: str, status: str, name: str = ""):
        await self.publish("agent:status", {
            "slug": slug, "status": status, "name": name,
        })

    async def chat_message(self, agent_slug: str, role: str, content: str, tokens: int = 0):
        await self.publish("chat:message", {
            "agent_slug": agent_slug, "role": role,
            "content": content, "tokens": tokens,
        })

    async def chat_typing(self, agent_slug: str, is_typing: bool):
        await self.publish("chat:typing", {
            "agent_slug": agent_slug, "is_typing": is_typing,
        })

    async def new_log(self, level: str, agent_slug: str, action: str, detail: str, duration_ms: int | None = None):
        await self.publish("log:new", {
            "level": level, "agent_slug": agent_slug,
            "action": action, "detail": detail, "duration_ms": duration_ms,
        })

    async def cost_alert(self, agent_slug: str, cost: float, threshold: float):
        await self.publish("alert:cost", {
            "agent_slug": agent_slug, "cost": round(cost, 5),
            "threshold": threshold,
        })

    async def finance_written(self, tab: str, confirmation: str):
        await self.publish("finance:written", {
            "tab": tab, "confirmation": confirmation,
        })

    async def system(self, message: str, level: str = "info"):
        await self.publish("system", {"message": message, "level": level})


# Singleton
event_manager = EventManager()
