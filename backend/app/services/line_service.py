import json
from urllib.parse import quote

from linebot.v3.messaging import (
    ApiClient,
    Configuration,
    MessagingApi,
    ReplyMessageRequest,
    TextMessage,
    FlexMessage,
    FlexContainer,
)

from app.core.config import settings
from app.services.pending_transaction_store import create_pending_transaction

configuration = Configuration(
    access_token=settings.LINE_CHANNEL_ACCESS_TOKEN
)

def reply_text(reply_token: str, text: str) -> None:
    with ApiClient(configuration) as api_client:
        line_bot_api = MessagingApi(api_client)

        line_bot_api.reply_message(
            reply_message_request=ReplyMessageRequest(
                reply_token=reply_token,
                messages=[
                    TextMessage(text=text)
                ]
            )
        )

def reply_confirmation_card(
        reply_token: str,
        transaction: dict,
) -> None:
    
    amount = float(transaction["amount"])
    transaction_type = transaction["type"]

    pending_id = create_pending_transaction(transaction)

    confirm_data = f"action=confirm_transaction&pending_id={pending_id}"
    cancel_data = f"action=cancel_transaction&pending_id={pending_id}"

    if transaction_type == "income":
        title = "ยืนยันการบันทึกรายรับ?"
        color = "#16A34A"
    
    else:
        title = "ยืนยันการบันทึกรายจ่าย?"
        color = "#DC2626"

    flex_content = {
        "type": "bubble",
        "size": "mega",
        "body": {
            "type": "box",
            "layout": "vertical",
            "spacing": "md",
            "contents": [
                {
                    "type": "text",
                    "text": "Coinly Confirmation",
                    "weight": "bold",
                    "size": "sm",
                    "color": "#64748B"
                },
                {
                    "type": "text",
                    "text": title,
                    "weight": "bold",
                    "size": "xl",
                    "color": color,
                    "wrap": True
                },
                {
                    "type": "separator",
                    "margin": "md"
                },
                {
                    "type": "box",
                    "layout": "vertical",
                    "spacing": "sm",
                    "margin": "md",
                    "contents": [
                        row_item("วันที่", transaction["transaction_date"]),
                        row_item("ประเภท", transaction["type"]),
                        row_item("หมวดหมู่", transaction["category"]),
                        row_item("จำนวนเงิน", f"{amount:,.2f} บาท"),
                        row_item("โน้ต", transaction.get("note") or "-"),
                    ],
                },
            ],
        },
        "footer": {
            "type": "box",
            "layout": "vertical",
            "contents": [
                {
                    "type": "button",
                    "style": "secondary",
                    "action": {
                        "type": "postback",
                        "label": "ยกเลิก",
                        "data": cancel_data,
                        "displayText": "ยกเลิก",
                    },
                },
                {
                    "type": "button",
                    "style": "primary",
                    "color": color,
                    "action": {
                        "type": "postback",
                        "label": "ยืนยัน",
                        "data": confirm_data,
                        "displayText": "ยืนยัน",
                    }
                }
            ],
        },
    }

    with ApiClient(configuration) as api_client:
        line_bot_api = MessagingApi(api_client)
        line_bot_api.reply_message(
            reply_message_request=ReplyMessageRequest(
                reply_token=reply_token,
                messages=[
                    FlexMessage(
                        alt_text="ยืนยันการบันทึกรายการ",
                        contents=FlexContainer.from_dict(flex_content),
                    )
                ],
            )
        )

def row_item(label: str, value: str) -> dict:
    return {
        "type": "box",
        "layout": "horizontal",
        "contents": [
            {
                "type": "text",
                "text": label,
                "size": "sm",
                "color": "#64748B",
                "flex": 2

            },
            {
                "type": "text",
                "text": str(value),
                "size": "sm",
                "color": "#111827",
                "align": "end",
                "wrap": True,
                "flex": 4,
            }
        ]
    }