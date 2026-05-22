from datetime import date
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator, model_validator

from app.core.transaction_config import is_valid_category, is_valid_transaction_type

class Transaction(BaseModel):
    transaction_date: date
    type: str
    category: str
    amount: float = Field(gt=0)
    note: Optional[str] = None

    @field_validator("type")
    @classmethod
    def validate_type(cls, value: str) -> str:
        value = value.lower().strip()

        if not is_valid_transaction_type(value):
            raise ValueError(f"Invalid trnasaction type: {value}")
        
        return value
    
    @field_validator("category")
    @classmethod
    def normalize_category(cls, value: str) -> str:
        return value.lower().strip()
    
    @field_validator("note")
    @classmethod
    def clean_note(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        
        return value.replace("\n", " ").strip()
    
    @model_validator(mode="after")
    def validate_category_for_type(self):
        if not is_valid_category(self.type, self.category):
            raise ValueError(f"Invalid category '{self.category}', for type '{self.type}'")
        
        return self

class LineTransactionCreate(Transaction):
    line_user_id: str
    raw_text: str

    