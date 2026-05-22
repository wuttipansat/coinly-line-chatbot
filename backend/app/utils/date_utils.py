from datetime import date, datetime, timedelta, timezone

def get_today_bangkok() -> date:
    bangkok_tz = timezone(timedelta(hours=7))
    return datetime.now(bangkok_tz).date()

def get_current_month_range() -> tuple[date, date]:
    today = get_today_bangkok()
    start_date = today.replace(day=1)
    end_date = today

    return start_date, end_date

def get_today_range() -> tuple[date, date]:
    today = get_today_bangkok()
    return today, today