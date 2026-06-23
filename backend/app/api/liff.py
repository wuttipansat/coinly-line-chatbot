from typing import Annotated, Literal
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Header, HTTPException, Query, status

from app.core.config import settings
from app.repositories.supabase_repository import SupabaseRepository
from app.services.line_liff_auth_service import verify_line_id_token
from app.core.transaction_config import get_category_ui
from app.schemas.transaction_schema import TransactionUpdate


router = APIRouter()
supabase_repo = SupabaseRepository()

def extract_bearer_token(
        authorization: str | None,
) -> str:
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="ไม่พบ Authorization header",
        )
    
    scheme, separator, token = authorization.partition(" ")

    if (
        not separator
        or scheme.lower() != "bearer"
        or not token.strip()
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="รูปแบบ Authorization ไม่ถูกต้อง",
        )
    
    return token.strip()

def validate_date_range(
        start_date: date | None,
        end_date: date | None,
) -> None:
    bangkok_tz = timezone(timedelta(hours=7))
    today = datetime.now(bangkok_tz).date()

    if start_date and end_date and start_date > end_date:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="start_date ต้องไม่มากกว่า end_date",
        )
    
    if start_date and start_date > today:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="ไม่สามารถเลือกวันที่ในอนาคตได้",
        )
    
    if end_date and end_date > today:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="ไม่สามารถเลือกวันที่ในอนาคตได้"
        )

@router.get("/config")
def get_liff_config():
    return {
        "liff_id": settings.LIFF_ID,
        "category_ui": get_category_ui(),
    }

@router.get("/summary")
async def get_all_transaction_summary(
    authorization: Annotated[str | None, Header()] = None,
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
):
    validate_date_range(start_date, end_date)

    id_token = extract_bearer_token(authorization)
    token_payload = await verify_line_id_token(id_token)
    line_user_id = token_payload["sub"]

    summary = supabase_repo.get_summary(
        line_user_id=line_user_id,
        start_date=start_date,
        end_date=end_date,
    )

    return summary

@router.get("/transactions")
async def get_all_transactions(
    authorization: Annotated[str | None, Header()] = None,
    limit: int = Query(default=20, ge=1, le=50),
    offset: int = Query(default=0, ge=0),
    transaction_type: Literal["income", "expense"] | None = Query(
        default=None
    ),
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
):
    validate_date_range(start_date, end_date)

    id_token = extract_bearer_token(authorization)
    token_payload = await verify_line_id_token(id_token)
    line_user_id = token_payload["sub"]

    items, has_more = (
        supabase_repo.get_line_transactions_page(
            line_user_id=line_user_id,
            limit=limit,
            offset=offset,
            transaction_type=transaction_type,
            start_date=start_date,
            end_date=end_date,
        )
    )

    next_offset = (
        offset + len(items)
        if has_more
        else None
    )

    return {
        "items": items,
        "has_more": has_more,
        "next_offset": next_offset
    }

@router.put("/transactions/{transaction_id}")
async def update_transaction(
    transaction_id: str,
    transaction: TransactionUpdate,
    authorization: Annotated[
        str | None,
        Header(),
    ] = None
):
    id_token = extract_bearer_token(
        authorization
    )

    token_payload = await verify_line_id_token(
        id_token
    )

    line_user_id = token_payload["sub"]

    updated = (
        supabase_repo.update_line_transaction(
            line_user_id=line_user_id,
            transaction_id=transaction_id,
            transaction=transaction
        )
    )

    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="ไม่พบรายการที่ต้องการแก้ไข"
        )
    
    return {
        "message": "แก้ไขรายการสำเร็จ",
        "item": updated,
    }

@router.delete("/transactions/{transaction_id}")
async def delete_transaction(
    transaction_id: str,
    authorization: Annotated[
        str | None,
        Header(),
    ] = None,
):
    id_token = extract_bearer_token(
        authorization
    )

    token_payload = await verify_line_id_token(
        id_token
    )

    line_user_id = token_payload["sub"]

    deleted = (
        supabase_repo.delete_line_transaction(
            line_user_id=line_user_id,
            transaction_id=transaction_id
        )
    )

    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="ไม่พบรายการที่ต้องการลบ",
        )
    
    return {
        "message": "ลบรายการสำเร็จ",
        "item": deleted,
    }


    
