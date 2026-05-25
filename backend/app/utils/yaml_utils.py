import yaml
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[2]
ANNOUCE_PATH = BASE_DIR / "config" / "annouce.yaml"

def load_announce(file_path: str | Path = ANNOUCE_PATH) -> str:
    with open(file_path, "r", encoding="utf-8") as file:
        data = yaml.safe_load(file)

    annouce = data.get("annouce", {})

    title = annouce.get("title", "")
    text = annouce.get("text", "")
    
    return f"{text}"

