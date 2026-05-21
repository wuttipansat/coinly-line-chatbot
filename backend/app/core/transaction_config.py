from pathlib import Path
from typing import Any

import yaml

BASE_DIR = Path(__file__).resolve().parents[2]
CONFIG_PATH = BASE_DIR / "config" / "transaction_config.yaml"

def load_transaction_config() -> dict[str, Any]:
    with open(CONFIG_PATH, "r", encoding="utf-8") as file:
        return yaml.safe_load(file)
    
transaction_config = load_transaction_config()

def get_transaction_types() -> list[str]:
    return list(transaction_config["transaction_types"].keys())

def get_transaction_type_descriptions() -> dict[str, str]:
    return transaction_config["transaction_types"]

def get_categories_by_type(transaction_type: str) -> list[str]:
    categories = transaction_config["categories"].get(transaction_type, {})
    return list(categories.keys())

def get_category_descriptions_by_type(transaction_type: str) -> dict[str, str]:
    return transaction_config["categories"].get(transaction_type, {})

def get_all_categories() -> list[str]:
    all_categories = []
    
    for category_dict in transaction_config["categories"].values():
        all_categories.extend(category_dict.keys())

    return all_categories

def get_all_category_descriptions() -> dict[str, dict[str, str]]:
    return transaction_config["categories"]

def is_valid_transaction_type(transaction_type: str) -> bool:
    return transaction_type in get_transaction_types()

def is_valid_category(transaction_type: str, category: str) -> bool:
    return category in get_categories_by_type(transaction_type)



