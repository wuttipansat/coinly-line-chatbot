from uuid import uuid4

pending_transactions = {}


def create_pending_transaction(transaction: dict) -> str:
    pending_id = str(uuid4())
    pending_transactions[pending_id] = transaction
    return pending_id

def get_pending_transaction(pending_id: str) -> dict | None:
    return pending_transactions.get(pending_id)

def delete_pending_transaction(pending_id: str) -> None:
    pending_transactions.pop(pending_id, None)


    