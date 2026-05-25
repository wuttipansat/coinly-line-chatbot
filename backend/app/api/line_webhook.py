from fastapi import APIRouter, Request, HTTPException

from urllib.parse import parse_qs, unquote

from linebot.v3 import WebhookHandler
from linebot.v3.exceptions import InvalidSignatureError
from linebot.v3.webhooks import MessageEvent, TextMessageContent, PostbackEvent

from app.core.config import settings
from app.schemas.transaction_schema import LineTransactionCreate
from app.services.ai_parser_service import parse_transaction_text
from app.services.line_service import reply_text, reply_transaction_card, reply_summary_card, reply_transaction_list_card, reply_deleted_transaction_card
from app.repositories.supabase_repository import SupabaseRepository
from app.utils.date_utils import get_today_range, get_current_month_range
from app.utils.yaml_utils import load_announce


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

    # print("User message:", user_text)
    # print("LINE user ID:", line_user_id)


    try:

        lower_text = user_text.lower()

        if lower_text in ["ประกาศ"]:
            announce = load_announce()

            if announce:
                reply_text(reply_token=reply_token, text=announce)
            else:
                reply_text(reply_token=reply_token, text="ยังไม่มีประกาศในตอนนี้")

            return
            

        if lower_text in ["วันนี้", "สรุปวันนี้", "today"]:
            start_date, end_date = get_today_range()

            summary = supabase_repo.get_summary(
                line_user_id = line_user_id,
                start_date=start_date,
                end_date=end_date
            )

            reply_summary_card(
                reply_token=reply_token,
                title="สรุปวันนี้",
                summary=summary
            )

            return
        
        if lower_text in ["เดือนนี้", "สรุปเดือนนี้", "month"]:
            start_date, end_date = get_current_month_range()
            
            summary = supabase_repo.get_summary(
                line_user_id=line_user_id,
                start_date=start_date,
                end_date=end_date
            )

            reply_summary_card(
                reply_token=reply_token,
                title="สรุปเดือนนี้",
                summary=summary
            )

            return
        
        if lower_text in ["รายการ", "ดูรายการ", "รายการล่าสุด", "recent", "list"]:
            transactions = supabase_repo.get_line_transactions(
                line_user_id=line_user_id,
                limit=10
            )

            reply_transaction_list_card(
                reply_token=reply_token,
                transactions=transactions,
                title="รายการล่าสุด",
            )

            return

        parsed = parse_transaction_text(user_text)

        transaction_data = {
            "line_user_id": line_user_id,
            "raw_text": user_text,
            "transaction_date": str(parsed.transaction_date),
            "type": parsed.type,
            "category": parsed.category,
            "amount": parsed.amount,
            "note": parsed.note,
        }

        transaction = LineTransactionCreate(**transaction_data)

        saved = supabase_repo.insert_line_transaction(transaction)

        reply_transaction_card(
            reply_token=reply_token,
            transaction=saved,
        )

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
    line_user_id = event.source.user_id

    try:
        parsed_data = parse_qs(data)

        action = parsed_data.get("action", [""])[0]
        transaction_id = parsed_data.get("transaction_id", [""])[0]

        if action == "delete_transaction":
            if not transaction_id:
                reply_text(reply_token, "ไม่พบรายการที่ต้องการลบ")
                return
            
            deleted = supabase_repo.delete_line_transaction(
                line_user_id=line_user_id,
                transaction_id=transaction_id,
            )

            if not deleted:
                reply_text(reply_token, "ไม่พบรายการนี้ หรือรายการนี้ถูกลบไปแล้ว")
                return
            
            reply_deleted_transaction_card(reply_token=reply_token, transaction=deleted)
            
        reply_text(reply_token, "ไม่พบคำสั่งที่เลือก")

    except Exception as e:
        print("Postback handling error:", repr(e))
        reply_text(
            reply_token,
            "ขออภัย ดำเนินการไม่สำเร็จครับ 🙏\n"
            f"รายละเอียด: {str(e)}",
        )