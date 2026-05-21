from datetime import date
from typing import Literal, Optional

from pydantic import BaseModel, Field

class Transaction(BaseModel):
    transaction_date: date
    type: Literal['income', 'expense']
    category: str
    amount: float = Field(gt=0)
    note: Optional[str] = None

class LineTransactionCreate(Transaction):
    line_user_id: str
    raw_text: str

    