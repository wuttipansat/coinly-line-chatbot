import httpx

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
            "Prefer": "return=representation"
        }
    
    async def insert_line_transaction(
            self,
            transaction: LineTransactionCreate,
    ) -> dict:
        
        payload = transaction.model_dump(mode='json')

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/rest/v1/line_transaction",
                headers=self.__headers(),
                json=payload
            )

        if response.status_code >= 400:
            raise Exception(f"Supabase error: {response.text}")
        
        return response.json()[0]
    

    