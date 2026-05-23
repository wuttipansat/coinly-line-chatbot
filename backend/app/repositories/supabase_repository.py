import httpx
from datetime import date

from app.core.config import settings
from app.schemas.transaction_schema import LineTransactionCreate


class SupabaseRepository:
    def __init__(self):
        self.base_url = settings.SUPABASE_URL
        self.key = settings.SUPABASE_SERVICE_ROLE_KEY

    def _headers(self) -> dict:
        return {
            "apikey": self.key,
            "Authorization": f"Bearer {self.key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        }

    def insert_line_transaction(self, transaction: LineTransactionCreate) -> dict:
        payload = transaction.model_dump(mode="json")

        response = httpx.post(
            f"{self.base_url}/rest/v1/line_transactions",
            headers=self._headers(),
            json=payload,
            timeout=30,
        )

        if response.status_code >= 400:
            raise Exception(f"Supabase error: {response.status_code} {response.text}")

        return response.json()[0]
    
    def get_line_transactions(
            self, 
            line_user_id: str, 
            start_date: date | None = None,
            end_date: date | None = None,
            limit: int | None = None,
    ) -> list[dict]:
        params = [
            ("select", "id,transaction_date,type,category,amount,note,raw_text,created_at"),
            ("line_user_id", f"eq.{line_user_id}"),
            ("order", "transaction_date.desc")
        ]

        if start_date:
            params.append(("transaction_date", f"gte.{start_date.isoformat()}"))

        if end_date:
            params.append(("transaction_date", f"lte.{end_date.isoformat()}"))

        if limit:
            params.append(("limit", str(limit)))

        response = httpx.get(
            f"{self.base_url}/rest/v1/line_transactions",
            headers=self._headers(),
            params=params,
            timeout=30,
        )

        if response.status_code >= 400:
            raise Exception(
                f"Supabase error: {response.status_code} {response.text}"
            )
        

        return response.json()
    
    def get_line_transaction_by_id(
            self,
            line_user_id: str,
            transaction_id: str,
    ) -> dict | None:
        
        params = [
            ("select", "id,transaction_date,type,category,amount,note,raw_text,created_at"),
            ("id", f"eq.{transaction_id}"),
            ("line_user_id", f"eq.{line_user_id}"),
            ("limit", "1"),
        ]

        response = httpx.get(
            f"{self.base_url}/rest/v1/line_transactions",
            headers=self.__headers(),
            params=params,
            timeout=30
        )

        if response.status_code >= 400:
            raise Exception(
                f"Supabase error: {response.status_code} {response.text}"
            )
        
        data = response.json()
        return data[0] if data else None
    
    def delete_line_transaction(
            self,
            line_user_id: str,
            transaction_id: str,
    ) -> dict | None:
        
        params = [
            ("id", f"eq.{transaction_id}"),
            ("line_user_id", f"eq. {line_user_id}")
        ]

        response = httpx.delete(
            f"{self.base_url}/rest/v1/line_transactions",
            headers=self.__headers(),
            params=params,
            timeout=30
        )

        if response.status_code >= 400:
            raise Exception(
                f"Supabase error: {response.status_code} {response.text}"
            )
        
        if not response.text:
            return None
        
        data = response.json()
        return data[0] if data else None
    
    def get_summary(
            self,
            line_user_id: str,
            start_date: date | None = None,
            end_date: date | None = None
    ) -> dict:
        transactions = self.get_line_transactions(
            line_user_id = line_user_id,
            start_date=start_date,
            end_date=end_date,
        )

        total_income = 0.0
        total_expense = 0.0


        for item in transactions:
            amount = float(item["amount"])
            transaction_type = item["type"]

            if transaction_type == "income":
                total_income += amount

            elif transaction_type == "expense":
                total_expense += amount

        return {
            "total_income": total_income,
            "total_expense": total_expense,
            "balance": total_income - total_expense,
            "transaction_count": len(transactions)
        }