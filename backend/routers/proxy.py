# -*- coding: utf-8 -*-
"""GET /proxy/portal-summary — proxy server-side al portal de ArchiTechIA."""
import httpx
from fastapi import APIRouter, Depends
from backend.routers.auth import get_current_user

router = APIRouter(prefix="/proxy", tags=["proxy"])

PORTAL_URL = "https://architechia-portal.vercel.app/api/public-summary"


@router.get("/portal-summary")
async def portal_summary(current_user=Depends(get_current_user)):
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(PORTAL_URL)
            return r.json()
    except Exception:
        return {"online": False}
