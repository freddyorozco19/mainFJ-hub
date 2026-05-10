# -*- coding: utf-8 -*-
"""GET /proxy/portal-summary — proxy server-side al portal de ArchiTechIA."""
import httpx
from fastapi import APIRouter

router = APIRouter(prefix="/proxy", tags=["proxy"])

PORTAL_URL = "https://architechia-portal.vercel.app/api/public-summary"


@router.get("/portal-summary")
async def portal_summary():
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(PORTAL_URL)
            return r.json()
    except Exception:
        return {"online": False}
