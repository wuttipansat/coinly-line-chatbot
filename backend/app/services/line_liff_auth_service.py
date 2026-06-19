from typing import Any

import httpx
from fastapi import HTTPException, status

from app.core.config import settings

LINE_VERIFY_ID_TOKEN_URL = "https://api.line.me/oauth2/v2.1/verify"

async def verify_line_id_token(id_token: str) -> dict[str, Any]:
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(
                LINE_VERIFY_ID_TOKEN_URL,
                data={
                    "id_token": id_token,
                    "client_id": settings.LINE_LOGIN_CHANNEL_ID,
                },
                headers={
                    "Content-Type": "application/x-www-form-urlencoded",
                },
            )

    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="ไม่สามารถเชื่อมต่อ LINE เพื่อยืนยันตัวตนได้"
        ) from exc
    
    if response.status_code != 200:
        print(
            "LINE ID token verification failed:",
            response.status_code,
            response.text,

        )

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="LINE ID Token ไม่ถูกต้องหรือหมดอายุ",
        )
    
    payload = response.json()
    line_user_id = payload.get("sub")
    audience = str(payload.get("aud", ""))

    if not line_user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="ไม่พบ LINE user ID ใน Token",
        )
    
    if audience != str(settings.LINE_LOGIN_CHANNEL_ID):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token ไม่ได้ออกให้กับ LINE Login Channel นี้",
        )
    
    return payload