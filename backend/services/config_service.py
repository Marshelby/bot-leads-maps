import json
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parents[2]
CONFIG_DIR = BASE_DIR / "config"
REGIONES_FILE = CONFIG_DIR / "regiones.json"
CIUDADES_FILE = CONFIG_DIR / "ciudades.json"
NICHOS_FILE = CONFIG_DIR / "nichos.json"


def normalize_config_list(values: list[str]) -> list[str]:
    cleaned_values = []
    seen = set()

    for value in values:
        cleaned_value = str(value).strip()
        if not cleaned_value:
            continue

        dedupe_key = cleaned_value.casefold()
        if dedupe_key in seen:
            continue

        seen.add(dedupe_key)
        cleaned_values.append(cleaned_value)

    return sorted(cleaned_values, key=str.casefold)


def get_regiones() -> list[str]:
    with REGIONES_FILE.open("r", encoding="utf-8") as file:
        data = json.load(file)

    if not isinstance(data, list):
        raise ValueError("config/regiones.json debe contener una lista.")

    return normalize_config_list(data)


def get_ciudades(region: str) -> list[str]:
    with CIUDADES_FILE.open("r", encoding="utf-8") as file:
        data = json.load(file)

    if not isinstance(data, dict):
        raise ValueError("config/ciudades.json debe contener un objeto por región.")

    ciudades = data.get(region, [])
    if not isinstance(ciudades, list):
        raise ValueError(f"La región '{region}' debe mapear a una lista de ciudades.")

    return normalize_config_list(ciudades)


def get_nichos() -> list[str]:
    with NICHOS_FILE.open("r", encoding="utf-8") as file:
        data = json.load(file)

    if not isinstance(data, list):
        raise ValueError("config/nichos.json debe contener una lista.")

    return normalize_config_list(data)
