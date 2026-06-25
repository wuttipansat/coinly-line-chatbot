from datetime import date, datetime

def compact_text(value, fallback="", max_chars=None):
    if value is None:
        return fallback

    text = " ".join(str(value).replace("\n", " ").split()).strip()
    if not text:
        return fallback

    if max_chars is not None and len(text) > max_chars:
        return text[: max_chars - 3].rstrip() + "..."

    return text


def format_transaction_date(value):
    if isinstance(value, datetime):
        parsed_date = value.date()
    elif isinstance(value, date):
        parsed_date = value
    else:
        raw_date = compact_text(value)
        if not raw_date:
            return "ไม่ระบุวันที่"

        parsed_date = None
        for candidate in (raw_date[:10], raw_date):
            try:
                parsed_date = date.fromisoformat(candidate)
                break
            except ValueError:
                continue

        if parsed_date is None:
            return compact_text(raw_date, fallback="ไม่ระบุวันที่", max_chars=18)

    thai_months = [
        "ม.ค.",
        "ก.พ.",
        "มี.ค.",
        "เม.ย.",
        "พ.ค.",
        "มิ.ย.",
        "ก.ค.",
        "ส.ค.",
        "ก.ย.",
        "ต.ค.",
        "พ.ย.",
        "ธ.ค.",
    ]
    return f"{parsed_date.day} {thai_months[parsed_date.month - 1]} {parsed_date.year}"


def format_amount(value):
    try:
        amount = abs(float(value))
    except (TypeError, ValueError):
        amount = 0.0

    return f"{amount:,.2f}"


def category_label(transaction_type, category):
    category_key = compact_text(category).lower()
    if not category_key:
        return "อื่นๆ"

    try:
        from app.core.transaction_config import get_category_ui

        category_ui = get_category_ui()
        label = (
            category_ui
            .get(transaction_type, {})
            .get(category_key, {})
            .get("label")
        )
    except Exception:
        label = None

    return compact_text(label or category_key, fallback="อื่นๆ", max_chars=24)


def meaningful_note(value):
    note = compact_text(value, max_chars=90)
    if note.lower() in {"-", "none", "null", "n/a"}:
        return ""
    return note