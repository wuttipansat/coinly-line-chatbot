from datetime import datetime, timedelta, timezone
import json
import re

from openai import OpenAI

from app.core.config import settings
from app.schemas.transaction_schema import Transaction
from app.core.transaction_config import(
    get_transaction_type_descriptions,
    get_all_category_descriptions
)

transaction_types = get_transaction_type_descriptions()
categories = get_all_category_descriptions()

client = OpenAI(base_url="https://openrouter.ai/api/v1", api_key=settings.OPENAI_API_KEY)

def parse_transaction_text(user_text: str) -> Transaction:
    bangkok_tz = timezone(timedelta(hours=7))
    today = datetime.now(bangkok_tz).date().isoformat()

    system_prompt = f"""
You are a transaction parser.

Extract exactly one transaction data from Thai or English text.

Today is {today} in Asia/Bangkok timezone.

Allowed transaction types with descriptions:
{transaction_types}

Allowed categories with descriptions:
{categories}

Return ONLY valid JSON. No markdown. No explanation.

Required JSON schema:
{{
  "transaction_date": "YYYY-MM-DD",
  "type": "income or expense",
  "category": "allowed category under selected type",
  "amount": number,
  "note": "short Thai note without amount"
}}

Rules:
- If no date is mentioned, use today's date: {today}.
- If user says "เมื่อวาน" or "yesterday", use yesterday's date.
- Use "expense" for spending, buying, eating, drinking, traveling, bills, or money paid out.
- Use "income" for salary, freelance income, investment return, gift, or money received.
- category must be one allowed category under the selected type.
- If category is unclear, use "other".
- amount must be numeric only.
- note must be Thai, concise, and must not include the amount.
"""
    
    response = client.chat.completions.create(
        model="openai/gpt-oss-120b:free",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_text}
        ],
        temperature=0,
    )
    
    content = response.choices[0].message.content

    if not content:
        raise ValueError("OpenRouter returned empty response")
    
    print("RAW CONTENT:", repr(content))
    
    json_text = clean_json_content(content)
    data = json.loads(json_text)

    return Transaction(**data)

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