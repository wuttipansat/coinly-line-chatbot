from pathlib import Path
from typing import Any

import yaml


BASE_DIR = Path(__file__).resolve().parents[2]
CONFIG_PATH = BASE_DIR / "config" / "transaction_config.yaml"


def load_transaction_config() -> dict[str, Any]:
    with open(CONFIG_PATH, "r", encoding="utf-8") as file:
        config = yaml.safe_load(file)

    if not isinstance(config, dict):
        raise ValueError(
            "transaction_config.yaml must contain a dictionary"
        )

    return config


transaction_config = load_transaction_config()


def get_transaction_types() -> list[str]:
    return list(
        transaction_config["transaction_types"].keys()
    )


def get_transaction_type_descriptions() -> dict[str, str]:
    return transaction_config["transaction_types"]


def get_categories_by_type(
    transaction_type: str,
) -> list[str]:
    categories = transaction_config[
        "categories"
    ].get(transaction_type, {})

    return list(categories.keys())


def _get_category_description(
    category_config: Any,
) -> str:

    if isinstance(category_config, dict):
        return str(
            category_config.get("description")
            or category_config.get("label")
            or ""
        )

    return str(category_config)


def get_category_descriptions_by_type(
    transaction_type: str,
) -> dict[str, str]:
    categories = transaction_config[
        "categories"
    ].get(transaction_type, {})

    return {
        category_key: _get_category_description(
            category_config
        )
        for category_key, category_config
        in categories.items()
    }


def get_all_categories() -> list[str]:
    all_categories: list[str] = []

    for category_dict in transaction_config[
        "categories"
    ].values():
        all_categories.extend(category_dict.keys())

    return all_categories


def get_all_category_descriptions(
) -> dict[str, dict[str, str]]:

    return {
        transaction_type: {
            category_key: _get_category_description(
                category_config
            )
            for category_key, category_config
            in categories.items()
        }
        for transaction_type, categories
        in transaction_config["categories"].items()
    }


def get_category_ui(
) -> dict[str, dict[str, dict[str, str]]]:

    result: dict[
        str,
        dict[str, dict[str, str]],
    ] = {}

    for transaction_type, categories in (
        transaction_config["categories"].items()
    ):
        result[transaction_type] = {}

        for category_key, category_config in (
            categories.items()
        ):
            if isinstance(category_config, dict):
                label = str(
                    category_config.get("label")
                    or category_key
                )

                icon = str(
                    category_config.get("icon")
                    or "🧾"
                )
            else:

                label = category_key
                icon = "🧾"

            result[transaction_type][category_key] = {
                "label": label,
                "icon": icon,
            }

    return result


def is_valid_transaction_type(
    transaction_type: str,
) -> bool:
    return transaction_type in get_transaction_types()


def is_valid_category(
    transaction_type: str,
    category: str,
) -> bool:
    return category in get_categories_by_type(
        transaction_type
    )