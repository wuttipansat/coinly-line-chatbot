from fastapi import APIRouter, Request, HTTPException

import json
from urllib.parse import parse_qs, unquote

from linebot.v3 import WebhookHandler
from linebot.v3.exceptions import InvalidSignatureError
from linebot.v3.webhooks import MessageEvent, TextMessageContent, PostbackEvent

from app.core.config import settings
from app.schemas.transaction_schema import LineTransactionCreate
from app.services.ai_parser_service import parse_transaction_text
from app.services.line_service import reply_text, reply_confirmation_card
from app.repositories.supabase_repository import SupabaseRepository
from app.services.pending_transaction_store import get_pending_transaction, delete_pending_transaction


router = APIRouter()

handler = WebhookHandler(settings.LINE_CHANNEL_SECRET)
supabase_repo = SupabaseRepository()


@router.get("/webhook")
def test_webhook():
    return {
        "message": "LINE webhook path is correct. Use POST for LINE webhook."
    }


@router.post("/webhook")
async def line_webhook(request: Request):
    signature = request.headers.get("X-Line-Signature")
    body = await request.body()
    body_text = body.decode("utf-8")

    try:
        handler.handle(body_text, signature)

    except InvalidSignatureError:
        print("Invalid LINE signature")
        raise HTTPException(status_code=400, detail="Invalid LINE Signature")

    except Exception as e:
        print("Webhook error:", repr(e))
        raise HTTPException(status_code=500, detail=str(e))

    return {"status": "ok"}


@handler.add(MessageEvent, message=TextMessageContent)
def handle_text_message(event):
    user_text = event.message.text
    line_user_id = event.source.user_id
    reply_token = event.reply_token

    print("User message:", user_text)
    print("LINE user ID:", line_user_id)

    try:
        parsed = parse_transaction_text(user_text)

        transaction = {
            "line_user_id": line_user_id,
            "raw_text": user_text,
            "transaction_date": str(parsed.transaction_date),
            "type": parsed.type,
            "category": parsed.category,
            "amount": parsed.amount,
            "note": parsed.note,
        }

        # saved = supabase_repo.insert_line_transaction(transaction)

        reply_confirmation_card(reply_token, transaction)

    except Exception as e:
        print("Message handling error:", repr(e))

        reply_text(
            reply_token,
            "ขออภัย บันทึกรายการไม่สำเร็จ 🙏\n"
            f"รายละเอียด: {str(e)}"
        )


@handler.add(PostbackEvent)
def handle_postback(event):
    reply_token = event.reply_token
    data = event.postback.data

    try:
        parsed_data = parse_qs(data)
        action = parsed_data.get("action", [""])[0]
        pending_id = parsed_data.get("pending_id", [""])[0]

        if not pending_id:
            reply_text(reply_token, "ไม่พบรายการที่ต้องการยืนยัน")
            return

        if action == "cancel_transaction":
            delete_pending_transaction(pending_id)
            reply_text(reply_token, "ยกเลิกการบันทึกรายการ")
            return
        
        if action == "confirm_transaction":
            transaction_dict = get_pending_transaction(pending_id)

            if not transaction_dict:
                reply_text(
                    reply_token,
                    "รายการนี้หมดอายุหรือถูกยืนยันไปแล้ว กรุณาส่งรายการใหม่อีกครั้ง"
                )

                return

            transaction = LineTransactionCreate(**transaction_dict)
            saved = supabase_repo.insert_line_transaction(transaction)

            delete_pending_transaction(pending_id)

            amount = float(saved["amount"])

            reply_text(
                reply_token,
                "บันทึกรายการสำเร็จ ✅\n\n"
                f"วันที่: {saved['transaction_date']}\n"
                f"ประเภท: {saved['type']}\n"
                f"หมวดหมู่: {saved['category']}\n"
                f"จำนวนเงิน: {amount:,.2f} บาท\n"
                f"โน้ต: {saved.get('note') or '-'}"
            )

            return
        
        reply_text(reply_token, "ไม่พบคำสั่งที่เลือก")

    except Exception as e:
        print("Postback handling error:", repr(e))
        reply_text(
            reply_token,
            "ขออภัย ยืนยันรายการไม่สำเร็จครับ 🙏\n"
            f"รายละเอียด: {str(e)}"
        )