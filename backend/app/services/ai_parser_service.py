from datetime import datetime
from zoneinfo import ZoneInfo

from openai import OpenAI

from app.core.config import settings
from app.schemas.transaction_schema import Transaction
from app.core.transaction_config import(
    get_transaction_type_descriptions,
    get_all_category_descriptions
)

transaction_types = get_transaction_type_descriptions()
categories = get_all_category_descriptions()

client = OpenAI(api_key=settings.OPENAI_API_KEY)

def parse_transaction_text(user_text: str) -> Transaction:
    today = datetime.now(ZoneInfo("Asia/Bangkok")).date().isoformat()

    system_prompt = f"""
You are a transaction parser.

Extract transaction data from Thai or English text.

Today is {today} in Asia/Bangkok timezone.

Allowed transaction types with descriptions:
{transaction_types}

Allowed categories with descriptions:
{categories}

Rules:
- Return only one transaction.
- transaction_date must be YYYY-MM-DD.
- If no date is mentioned, use today's date.
- type must be one of the allowed transaction types.
- category must be one of the allowed categories under the selected type.
- If the user bought, paid, spent, ate, drank, traveled, or transferred money out, use "expense".
- If the user received money, salary, freelance income, gift money, investment return, or other earned money, use "income".
- Use the category descriptions to choose the best category.
- amount must be a number.
- note should be a short summary of the original message.
"""
    
    response = client.responses.parse(
        model="gpt-5.4-mini",
        input=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_text}
        ],
        text_format=Transaction,
    )

    return response.output_parsed

