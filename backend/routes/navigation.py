# backend/routes/navigation.py
from fastapi import APIRouter, Query, HTTPException
from fastapi.responses import JSONResponse
from typing import Optional

router = APIRouter()

@router.get("/health")
async def navigation_health():
    return {"status": "ok", "component": "navigation"}

# Example placeholder endpoints you can expand later
@router.get("/example-route")
async def example_route(q: Optional[str] = Query(None)):
    if not q:
        return JSONResponse(status_code=400, content={"error": "missing q"})
    return {"status": "ok", "query": q}
