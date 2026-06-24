from datetime import datetime, timedelta, timezone
import json
import re
import logging

from openai import OpenAI

from app.core.config import settings
from app.schemas.transaction_schema import Transaction
from app.core.transaction_config import(
    get_transaction_type_descriptions,
    get_all_category_descriptions
)

logger = logging.getLogger(__name__)
transaction_types = get_transaction_type_descriptions()
categories = get_all_category_descriptions()

client = OpenAI(base_url="https://openrouter.ai/api/v1", api_key=settings.OPENAI_API_KEY)

def parse_transaction_text(user_text: str) -> Transaction:
    bangkok_tz = timezone(timedelta(hours=7))
    today = datetime.now(bangkok_tz).date()
    today_iso = today.isoformat()

    system_prompt = f"""
You are a transaction parser.

Extract exactly one transaction from Thai or English text.

Reference date: {today_iso}
Timezone: Asia/Bangkok

Transaction types:
{transaction_types}

Categories:
{categories}

Return only one valid JSON object:

{{
  "transaction_date": "YYYY-MM-DD",
  "type": "income or expense",
  "category": "allowed category under the selected type",
  "amount": number,
  "note": "short Thai note without amount"
}}

Requirements:
- Transactions must not have a future date.
- Resolve explicit and relative date expressions using the reference date.
- If only a weekday is mentioned, use its most recent occurrence on or before the reference.
- Use the reference date if no date is mentioned.
- Use only the provided transaction types and categories.
- If category is unclear, use "other".
- amount must be numeric and greater than 0.
- Return a short, concise note in Thai.
"""
    
    response = client.chat.completions.create(
        model="openai/gpt-oss-120b:free",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_text}
        ],
        temperature=0,
    )

    usage = getattr(response, "usage", None)
    if usage:
        logger.info(
            "AI token usage: prompt=%s completion=%s total=%s",
            usage.prompt_tokens,
            usage.completion_tokens,
            usage.total_tokens,
        )
    
    content = response.choices[0].message.content

    if not content:
        raise ValueError("OpenRouter returned empty response")
    
    print("RAW CONTENT:", repr(content))
    
    json_text = clean_json_content(content)
    data = json.loads(json_text)

    validate_transaction_date(data)

    return Transaction(**data)

def validate_transaction_date(data: dict) -> None:
    transaction_date = data.get("transaction_date")

    if not transaction_date:
        raise ValueError("Missing transaction_date")

    try:
        datetime.strptime(transaction_date, "%Y-%m-%d")
    except ValueError as exc:
        raise ValueError(
            f"Invalid transaction_date: {transaction_date}"
        ) from exc

def clean_json_content(content: str) -> str:
    content = content.strip()

    content = content.replace("```json", "")
    content = content.replace("```", "")
    content = content.strip()

    match = re.search(r"\{.*\}", content, re.DOTALL)

    if not match:
        raise ValueError(f"No JSON object found: {content}")

    json_text = match.group(0)

    json_text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", json_text)

    return json_text