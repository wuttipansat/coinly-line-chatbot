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

def reply_transaction_card(
        reply_token: str,
        transaction: dict,
) -> None:
    amount = float(transaction["amount"])
    transaction_type = transaction["type"]

    if transaction_type == "income":
        type_label = "รายรับ"
        title = "บันทึกรายรับสำเร็จ"
        amount_color = "#16A34A"
        type_emoji = "💰"
    else:
        type_label = "รายจ่าย"
        title = "บันทึกรายจ่ายสำเร็จ"
        amount_color = "#DC2626"
        type_emoji = "💸"


    flex_content = {
        "type": "bubble",
        "size": "mega",
        "styles": {
            "body": {
                "backgroundColor": "#FFF8E1"
            },
            "footer": {
                "backgroundColor": "#FFF8E1"
            }
        },
        "header": {
            "type": "box",
            "layout": "vertical",
            "backgroundColor": "#D4AF37",
            "paddingAll": "18px",
            "contents": [
                {
                    "type": "text",
                    "text": "🐷 Coinly",
                    "weight": "bold",
                    "size": "xl",
                    "color": "#3A2A0A"
                },
                {
                    "type": "text",
                    "text": "ผู้ช่วยบันทึกรายรับรายจ่าย",
                    "size": "xs",
                    "color": "#5C4510",
                    "margin": "xs"
                }
            ]
        },
        "body": {
            "type": "box",
            "layout": "vertical",
            "spacing": "md",
            "paddingAll": "18px",
            "contents": [
                {
                    "type": "box",
                    "layout": "vertical",
                    "backgroundColor": "#FFF1B8",
                    "cornerRadius": "16px",
                    "paddingAll": "16px",
                    "contents": [
                        {
                            "type": "text",
                            "text": f"{type_emoji} {title}",
                            "weight": "bold",
                            "size": "lg",
                            "color": "#3A2A0A",
                            "wrap": True
                        },
                        {
                            "type": "text",
                            "text": f"{amount:,.2f} บาท",
                            "weight": "bold",
                            "size": "xxl",
                            "color": amount_color,
                            "margin": "md",
                            "wrap": True
                        }
                    ]
                },
                {
                    "type": "separator",
                    "margin": "md",
                    "color": "#E0C56E"
                },
                {
                    "type": "box",
                    "layout": "vertical",
                    "spacing": "sm",
                    "margin": "md",
                    "contents": [
                        row_item("วันที่", transaction["transaction_date"]),
                        row_item("ประเภท", type_label),
                        row_item("หมวดหมู่", transaction["category"]),
                        row_item("โน้ต", transaction.get("note") or "-"),
                    ],
                },
            ],
        },
        "footer": {
            "type": "box",
            "layout": "vertical",
            "spacing": "sm",
            "paddingAll": "18px",
            "contents": [
                {
                    "type": "button",
                    "style": "primary",
                    "height": "sm",
                    "color": "#D4AF37",
                    "action": {
                        "type": "message",
                        "label": "ดูรายการล่าสุด",
                        "text": "รายการ",
                    },
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
                        alt_text="บันทึกรายการสำเร็จ",
                        contents=FlexContainer.from_dict(flex_content),
                    )
                ],
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
                "color": "#8A6D1D",
                "flex": 3,
            },
            {
                "type": "text",
                "text": str(value),
                "size": "sm",
                "color": "#3A2A0A",
                "weight": "bold",
                "align": "end",
                "wrap": True,
                "flex": 5,
            },
        ],
    }



def summary_row(label: str, value: str, bold: bool = False, value_color: str = "#3A2A0A") -> dict:
    return {
        "type": "box",
        "layout": "horizontal",
        "contents": [
            {
                "type": "text",
                "text": label,
                "size": "sm",
                "color": "#8A6D1D",
                "flex": 4,
                "weight": "bold" if bold else "regular",
            },
            {
                "type": "text",
                "text": value,
                "size": "sm",
                "color": value_color,
                "weight": "bold" if bold else "regular",
                "align": "end",
                "wrap": True,
                "flex": 5,
            },
        ],
    }


def reply_summary_card(
    reply_token: str,
    title: str,
    summary: dict,
) -> None:
    total_income = float(summary["total_income"])
    total_expense = float(summary["total_expense"])
    balance = float(summary["balance"])
    transaction_count = summary["transaction_count"]

    balance_color = "#16A34A" if balance >= 0 else "#DC2626"
    balance_status = "ยอดคงเหลือเป็นบวก" if balance >= 0 else "ยอดคงเหลือติดลบ"
    balance_emoji = "✅" if balance >= 0 else "⚠️"

    flex_content = {
        "type": "bubble",
        "size": "mega",
        "styles": {
            "body": {
                "backgroundColor": "#FFF8E1"
            },
            "footer": {
                "backgroundColor": "#FFF8E1"
            }
        },
        "header": {
            "type": "box",
            "layout": "vertical",
            "backgroundColor": "#D4AF37",
            "paddingAll": "18px",
            "contents": [
                {
                    "type": "text",
                    "text": "🐷 Coinly",
                    "weight": "bold",
                    "size": "xl",
                    "color": "#3A2A0A"
                },
                {
                    "type": "text",
                    "text": "สรุปรายรับรายจ่าย",
                    "size": "xs",
                    "color": "#5C4510",
                    "margin": "xs"
                }
            ]
        },
        "body": {
            "type": "box",
            "layout": "vertical",
            "spacing": "md",
            "paddingAll": "18px",
            "contents": [
                {
                    "type": "box",
                    "layout": "vertical",
                    "backgroundColor": "#FFF1B8",
                    "cornerRadius": "16px",
                    "paddingAll": "16px",
                    "contents": [
                        {
                            "type": "text",
                            "text": title,
                            "weight": "bold",
                            "size": "lg",
                            "color": "#3A2A0A",
                            "wrap": True
                        },
                        {
                            "type": "text",
                            "text": f"{balance:,.2f} บาท",
                            "weight": "bold",
                            "size": "xxl",
                            "color": balance_color,
                            "margin": "md",
                            "wrap": True
                        },
                        {
                            "type": "text",
                            "text": f"{balance_emoji} {balance_status}",
                            "size": "xs",
                            "color": balance_color,
                            "margin": "sm",
                            "wrap": True
                        }
                    ]
                },
                {
                    "type": "separator",
                    "margin": "md",
                    "color": "#E0C56E"
                },
                {
                    "type": "box",
                    "layout": "vertical",
                    "spacing": "sm",
                    "margin": "md",
                    "contents": [
                        summary_row("รายรับรวม", f"{total_income:,.2f} บาท", value_color="#16A34A"),
                        summary_row("รายจ่ายรวม", f"{total_expense:,.2f} บาท", value_color="#DC2626"),
                        summary_row("คงเหลือ", f"{balance:,.2f} บาท", bold=True, value_color=balance_color),
                        summary_row("จำนวนรายการ", f"{transaction_count} รายการ"),
                    ],
                },
            ],
        },
        "footer": {
            "type": "box",
            "layout": "vertical",
            "spacing": "sm",
            "paddingAll": "18px",
            "contents": [
                {
                    "type": "button",
                    "style": "primary",
                    "height": "sm",
                    "color": "#D4AF37",
                    "action": {
                        "type": "message",
                        "label": "ดูรายการล่าสุด",
                        "text": "รายการ",
                    },
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
                        alt_text=title,
                        contents=FlexContainer.from_dict(flex_content),
                    )
                ],
            )
        )

def reply_transaction_list_card(
        reply_token: str,
        transactions: list[dict],
        title: str = "รายการล่าสุด",
) -> None:
    
    if not transactions:
        reply_text(reply_token, "ยังไม่มีรายการที่บันทึกไว้")
        return

    bubbles = []

    for item in transactions[:10]:
        amount = float(item["amount"])
        transaction_type = item["type"]

        if transaction_type == "income":
            type_label = "รายรับ"
            type_color = "#16A34A"
            type_emoji = "💰"
        else:
            type_label = "รายจ่าย"
            type_color = "#DC2626"
            type_emoji = "💸"

        delete_data = (
            f"action=delete_transaction"
            f"&transaction_id={item['id']}"
        )

        bubble = {
            "type": "bubble",
            "size": "kilo",
            "styles": {
                "body": {
                    "backgroundColor": "#FFF8E1"
                },
                "footer": {
                    "backgroundColor": "#FFF8E1"
                }
            },
            "body": {
                "type": "box",
                "layout": "vertical",
                "spacing": "sm",
                "paddingAll": "14px",
                "contents": [
                    {
                        "type": "box",
                        "layout": "vertical",
                        "backgroundColor": "#FFF1B8",
                        "cornerRadius": "14px",
                        "paddingAll": "12px",
                        "contents": [
                            {
                                "type": "text",
                                "text": f"{type_emoji} {type_label}",
                                "weight": "bold",
                                "size": "sm",
                                "color": type_color,
                                "wrap": True,
                            },
                            {
                                "type": "text",
                                "text": f"{amount:,.2f} บาท",
                                "weight": "bold",
                                "size": "xl",
                                "color": "#3A2A0A",
                                "margin": "sm",
                                "wrap": True,
                            },
                        ],
                    },
                    {
                        "type": "separator",
                        "margin": "md",
                        "color": "#E0C56E",
                    },
                    {
                        "type": "box",
                        "layout": "vertical",
                        "spacing": "xs",
                        "margin": "md",
                        "contents": [
                            row_item("วันที่", item["transaction_date"]),
                            row_item("หมวดหมู่", item["category"]),
                            row_item("โน้ต", item.get("note") or "-"),
                        ],
                    },
                ],
            },
            "footer": {
                "type": "box",
                "layout": "vertical",
                "spacing": "sm",
                "paddingAll": "14px",
                "contents": [
                    {
                        "type": "button",
                        "style": "primary",
                        "height": "sm",
                        "color": "#DC2626",
                        "action": {
                            "type": "postback",
                            "label": "ลบรายการนี้",
                            "data": delete_data,
                            "displayText": "ลบรายการนี้",
                        },
                    }
                ],
            },
        }

        

        bubbles.append(bubble)

    flex_content = {
        "type": "carousel",
        "contents": bubbles,
    }

    if not transactions:
            flex_content = {
                "type": "bubble",
                "size": "mega",
                "styles": {
                    "body": {
                        "backgroundColor": "#FFF8E1"
                    }
                },
                "body": {
                    "type": "box",
                    "layout": "vertical",
                    "spacing": "md",
                    "paddingAll": "18px",
                    "contents": [
                        {
                            "type": "text",
                            "text": "🐷 Coinly",
                            "weight": "bold",
                            "size": "xl",
                            "color": "#3A2A0A",
                        },
                        {
                            "type": "text",
                            "text": "ยังไม่มีรายการธุรกรรม",
                            "weight": "bold",
                            "size": "lg",
                            "color": "#8A6D1D",
                            "wrap": True,
                        },
                        {
                            "type": "text",
                            "text": "ลองพิมพ์ เช่น กินข้าว 80 บาท",
                            "size": "sm",
                            "color": "#8A6D1D",
                            "wrap": True,
                        },
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
                        alt_text=title,
                        contents=FlexContainer.from_dict(flex_content),
                    )
                ],
            )
        )

def reply_deleted_transaction_card(
    reply_token: str,
    transaction: dict,
) -> None:
    amount = float(transaction["amount"])

    transaction_type = transaction["type"]

    if transaction_type == "income":
        type_label = "รายรับ"
        type_color = "#16A34A"
        type_emoji = "💰"
    else:
        type_label = "รายจ่าย"
        type_color = "#DC2626"
        type_emoji = "💸"


    flex_content = {
        "type": "bubble",
        "size": "mega",
        "styles": {
            "body": {
                "backgroundColor": "#FFF8E1"
            },
            "footer": {
                "backgroundColor": "#FFF8E1"
            }
        },
        "header": {
            "type": "box",
            "layout": "vertical",
            "backgroundColor": "#D4AF37",
            "paddingAll": "18px",
            "contents": [
                {
                    "type": "text",
                    "text": "🐷 Coinly",
                    "weight": "bold",
                    "size": "xl",
                    "color": "#3A2A0A"
                },
                {
                    "type": "text",
                    "text": "ผู้ช่วยบันทึกรายรับรายจ่าย",
                    "size": "xs",
                    "color": "#5C4510",
                    "margin": "xs"
                }
            ]
        },
        "body": {
            "type": "box",
            "layout": "vertical",
            "spacing": "md",
            "paddingAll": "18px",
            "contents": [
                {
                    "type": "box",
                    "layout": "vertical",
                    "backgroundColor": "#FFF1B8",
                    "cornerRadius": "16px",
                    "paddingAll": "16px",
                    "contents": [
                        {
                            "type": "text",
                            "text": "🗑️ ลบรายการสำเร็จ",
                            "weight": "bold",
                            "size": "lg",
                            "color": "#B91C1C",
                            "wrap": True
                        },
                        {
                            "type": "text",
                            "text": f"{type_emoji} {amount:,.2f} บาท",
                            "weight": "bold",
                            "size": "xxl",
                            "color": type_color,
                            "margin": "md",
                            "wrap": True
                        },
                        {
                            "type": "text",
                            "text": "รายการนี้ถูกนำออกจากระบบแล้ว",
                            "size": "xs",
                            "color": "#8A6D1D",
                            "margin": "sm",
                            "wrap": True
                        }
                    ]
                },
                {
                    "type": "separator",
                    "margin": "md",
                    "color": "#E0C56E"
                },
                {
                    "type": "box",
                    "layout": "vertical",
                    "spacing": "sm",
                    "margin": "md",
                    "contents": [
                        row_item("วันที่", transaction["transaction_date"]),
                        row_item("ประเภท", type_label),
                        row_item("หมวดหมู่", transaction["category"]),
                        row_item("โน้ต", transaction.get("note") or "-"),
                    ],
                },
            ],
        },
        "footer": {
            "type": "box",
            "layout": "vertical",
            "spacing": "sm",
            "paddingAll": "18px",
            "contents": [
                {
                    "type": "button",
                    "style": "primary",
                    "height": "sm",
                    "color": "#D4AF37",
                    "action": {
                        "type": "message",
                        "label": "ดูรายการล่าสุด",
                        "text": "รายการ",
                    },
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
                        alt_text="ลบรายการสำเร็จ",
                        contents=FlexContainer.from_dict(flex_content),
                    )
                ],
            )
        )

def reply_delete_confirm_card(
        reply_token: str,
        transaction: dict,
) -> None:
    amount = float(transaction["amount"])

    delete_data = (
        f"action=confirm_delete_transaction"
        f"&transaction_id={transaction['id']}"
    )
    cancel_data = "action=cancel_delete_transaction"

    transaction_type = transaction["type"]
    color = "#16A34A" if transaction_type == "income" else "#DC2626"

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
                    "text": "Coinly Delete Confirmation",
                    "weight": "bold",
                    "size": "sm",
                    "color": "#64748B",
                },
                {
                    "type": "text",
                    "text": "ยืนยันการลบรายการนี้?",
                    "weight": "bold",
                    "size": "xl",
                    "color": color,
                    "wrap": True,
                },
                {
                    "type": "separator",
                    "margin": "md",
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
                        "displayText": "ยกเลิกการลบ",
                    },
                },
                {
                    "type": "button",
                    "style": "primary",
                    "color": "#DC2626",
                    "action": {
                        "type": "postback",
                        "label": "ยืนยันลบ",
                        "data": delete_data,
                        "displayText": "ยืนยันลบรายการ",
                    },
                },
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
                        alt_text="ยืนยันการลบรายการ",
                        contents=FlexContainer.from_dict(flex_content),
                    )
                ],
            )
        )