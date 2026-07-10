from datetime import datetime, timedelta, timezone, date
import json
import re
import logging
import os
from typing import Any

from langchain_core.prompts import ChatPromptTemplate
from langchain_openrouter import ChatOpenRouter

from app.core.config import settings
from app.schemas.transaction_schema import Transaction
from app.core.transaction_config import (
    get_transaction_type_descriptions,
    get_all_category_descriptions,
)

logger = logging.getLogger(__name__)

transaction_types = get_transaction_type_descriptions()
categories = get_all_category_descriptions()

MODEL_NAME = "nvidia/nemotron-3-super-120b-a12b:free"

# ChatOpenRouter expects OPENROUTER_API_KEY.
# Your project currently uses settings.OPENAI_API_KEY, so we map it here.
if settings.OPENAI_API_KEY:
    os.environ.setdefault("OPENROUTER_API_KEY", settings.OPENAI_API_KEY)

llm = ChatOpenRouter(
    model=MODEL_NAME,
    temperature=0,
    max_retries=2,
)

transaction_prompt = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            """
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
- Return JSON only. Do not include markdown or explanation.
""",
        ),
        ("human", "{user_text}"),
    ]
)


def parse_transaction_text(user_text: str) -> Transaction:
    bangkok_tz = timezone(timedelta(hours=7))
    today = datetime.now(bangkok_tz).date()
    today_iso = today.isoformat()

    chain_inputs = {
        "today_iso": today_iso,
        "transaction_types": transaction_types,
        "categories": categories,
        "user_text": user_text,
    }

    try:
        transaction = parse_with_structured_output(chain_inputs)

    except Exception as exc:
        logger.warning(
            "Structured LangChain parsing failed. Falling back to JSON parsing. Error: %s",
            exc,
        )
        transaction = parse_with_json_fallback(chain_inputs)

    validate_transaction_date(transaction.transaction_date, today)

    return transaction


def parse_with_structured_output(chain_inputs: dict[str, Any]) -> Transaction:
    structured_llm = llm.with_structured_output(
        Transaction,
        method="json_schema",
        include_raw=True,
    )

    chain = transaction_prompt | structured_llm
    result = chain.invoke(chain_inputs)

    raw_message = result.get("raw")
    parsed_transaction = result.get("parsed")
    parsing_error = result.get("parsing_error")

    log_token_usage(raw_message)

    if parsing_error:
        raise ValueError(f"Structured output parsing error: {parsing_error}")

    if parsed_transaction is None:
        raise ValueError("Structured output returned no parsed transaction")

    return parsed_transaction


def parse_with_json_fallback(chain_inputs: dict[str, Any]) -> Transaction:
    chain = transaction_prompt | llm
    response = chain.invoke(chain_inputs)

    log_token_usage(response)

    content = response.content

    if not content:
        raise ValueError("OpenRouter returned empty response")

    logger.debug("RAW CONTENT: %r", content)

    json_text = clean_json_content(str(content))
    data = json.loads(json_text)

    return Transaction(**data)


def validate_transaction_date(transaction_date: str | date, reference_date: date) -> None:
    if not transaction_date:
        raise ValueError("Missing transaction_date")

    if isinstance(transaction_date, date):
        parsed_date = transaction_date
    else:
        try:
            parsed_date = datetime.strptime(str(transaction_date), "%Y-%m-%d").date()
        except ValueError as exc:
            raise ValueError(
                f"Invalid transaction_date: {transaction_date}"
            ) from exc

    if parsed_date > reference_date:
        raise ValueError(
            f"Transaction date cannot be in the future: {transaction_date}"
        )


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


def log_token_usage(response: Any) -> None:
    if response is None:
        return

    usage = getattr(response, "usage_metadata", None)

    if not usage:
        return

    logger.info(
        "AI token usage: input=%s output=%s total=%s",
        usage.get("input_tokens"),
        usage.get("output_tokens"),
        usage.get("total_tokens"),
    )