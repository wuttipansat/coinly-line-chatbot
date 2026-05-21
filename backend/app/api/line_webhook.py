from fastapi import APIRouter, Request, HTTPException

from linebot.v3 import WebhookHandler
from linebot.v3.exceptions import InvalidSignatureError
from linebot.v3.webhooks import MessageEvent, TextMessageContent

from app.core.config import settings
from app.schemas.transaction_schema import LineTransactionCreate
from app.services.ai_parser_service import parse_transaction_text
from app.services.line_service import reply_text
from app.repositories.supabase_repository import SupabaseRepository

router = APIRouter()

handler = WebhookHandler(settings.LINE_CHANNEL_SECRET)
supabase_repo = SupabaseRepository()

@router.post("/webhook")
async def line_webhook(request: Request):
    signature = request.headers.get("X-Line-Signature")
    body = await request.body()
    body_text = body.decode("utf-8")

    try:
        handler.handle(body_text, signature)
    except InvalidSignatureError:
        raise HTTPException(status_code=400, detail="Invalid Line Signature")
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
    return {"status": "ok"}


@handler.add(MessageEvent, message=TextMessageContent)
def handle_text_message(event):
    user_text = event.message.text
    line_user_id = event.source.user_id
    reply_token = event.reply_token

    try:
        parsed = parse_transaction_text(user_text)

        transaction = LineTransactionCreate(
            line_user_id=line_user_id,
            raw_text=user_text,
            transaction_date=parsed.transaction_date,
            type=parsed.type,
            category=parsed.category,
            amount=parsed.amount,
            note=parsed.note
        )

        import asyncio
        saved = asyncio.run(
            supabase_repo.insert_line_transaction(transaction)
        )

        amount = float(saved["amount"])

        reply = (
            "บันทึกรายการสำเร็จ ✅\n\n"
            f"วันที่: {saved['transaction_date']}\n"
            f"ประเภท: {saved['type']}\n"
            f"หมวดหมู่: {saved['category']}\n"
            f"จำนวนเงิน: {amount:,.2f} บาท\n"
            f"โน้ต: {saved.get('note') or '-'}"
        )

        reply_text(reply_token, reply)

    except Exception as e:
        reply_text(
            reply_token,
            "ขออภัย บันทึกรายการไม่สำเร็จครับ 🙏\n"
            f"รายละเอียด: {str(e)}"
        )