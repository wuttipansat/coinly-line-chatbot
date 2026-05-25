import yaml
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[2]
ANNOUCE_PATH = BASE_DIR / "config" / "announce.yaml"

import yaml


def load_announce(file_path=ANNOUCE_PATH) -> str | None:
    try:
        with open(file_path, "r", encoding="utf-8") as file:
            data = yaml.safe_load(file) or {}

        announce = data.get("announce", {})

        if not announce.get("enabled", False):
            return None

        title = str(announce.get("title", "ประกาศจากระบบ")).strip()
        text = str(announce.get("text", "")).strip()

        if not text:
            return None

        return f"{text}"

    except Exception as e:
        print(f"Load announce error: {e}")
        return None