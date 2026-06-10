import json
import re
import unicodedata
from pathlib import Path
from typing import Any


BASE_DIR = Path(__file__).resolve().parents[2]
CONFIG_DIR = BASE_DIR / "config"
GEOGRAPHY_FILE = CONFIG_DIR / "geografia.json"
REGIONES_FILE = CONFIG_DIR / "regiones.json"
CIUDADES_FILE = CONFIG_DIR / "ciudades.json"
NICHOS_FILE = CONFIG_DIR / "nichos.json"
DEFAULT_COUNTRY = "chile"


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


def normalize_slug(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", str(value).strip())
    ascii_only = normalized.encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-z0-9]+", "_", ascii_only.lower()).strip("_")
    return slug or "desconocido"


def load_geography_data() -> dict[str, Any]:
    with GEOGRAPHY_FILE.open("r", encoding="utf-8") as file:
        data = json.load(file)

    if not isinstance(data, dict):
        raise ValueError("config/geografia.json debe contener un objeto raíz.")

    countries = data.get("countries")
    if not isinstance(countries, dict):
        raise ValueError("config/geografia.json debe contener una clave 'countries'.")

    return countries


def get_countries() -> list[dict[str, str]]:
    countries = load_geography_data()
    items = []

    for country_id, country_data in countries.items():
        if not isinstance(country_data, dict):
            raise ValueError(f"El país '{country_id}' en config/geografia.json no es válido.")

        label = str(country_data.get("label", "")).strip()
        if not label:
            raise ValueError(f"El país '{country_id}' debe definir un label.")

        items.append({"id": str(country_id).strip(), "label": label})

    return sorted(items, key=lambda item: item["label"].casefold())


def get_country(country: str = DEFAULT_COUNTRY) -> dict[str, Any]:
    country_id = normalize_slug(country or DEFAULT_COUNTRY)
    countries = load_geography_data()
    country_data = countries.get(country_id)

    if not isinstance(country_data, dict):
        raise ValueError(f"El país '{country}' no existe en config/geografia.json.")

    return {
        "id": country_id,
        "label": str(country_data.get("label", "")).strip() or country_id,
        "regions": country_data.get("regions", {}),
    }


def get_regiones(country: str = DEFAULT_COUNTRY) -> list[str]:
    country_data = get_country(country)
    regions = country_data.get("regions")

    if not isinstance(regions, dict):
        raise ValueError(f"El país '{country_data['label']}' debe contener un objeto 'regions'.")

    labels = []
    for region_id, region_data in regions.items():
        if not isinstance(region_data, dict):
            raise ValueError(f"La región '{region_id}' en '{country_data['label']}' no es válida.")

        label = str(region_data.get("label", "")).strip()
        if not label:
            raise ValueError(f"La región '{region_id}' en '{country_data['label']}' debe definir un label.")
        labels.append(label)

    return normalize_config_list(labels)


def get_region(country: str, region: str) -> dict[str, Any]:
    country_data = get_country(country)
    regions = country_data.get("regions")

    if not isinstance(regions, dict):
        raise ValueError(f"El país '{country_data['label']}' debe contener un objeto 'regions'.")

    region_slug = normalize_slug(region)
    for region_id, region_data in regions.items():
        if not isinstance(region_data, dict):
            continue

        label = str(region_data.get("label", "")).strip()
        if region_id == region_slug or label.casefold() == str(region).strip().casefold():
            return {
                "id": str(region_id).strip(),
                "label": label,
                "cities": region_data.get("cities", []),
            }

    raise ValueError(
        f"La región '{region}' no existe para el país '{country_data['label']}' en config/geografia.json."
    )


def get_ciudades(region: str, country: str = DEFAULT_COUNTRY) -> list[str]:
    region_data = get_region(country, region)
    cities = region_data.get("cities")

    if not isinstance(cities, list):
        raise ValueError(
            f"La región '{region_data['label']}' del país '{country}' debe mapear a una lista de ciudades."
        )

    return normalize_config_list([str(city) for city in cities])


def get_nichos() -> list[str]:
    with NICHOS_FILE.open("r", encoding="utf-8") as file:
        data = json.load(file)

    if not isinstance(data, list):
        raise ValueError("config/nichos.json debe contener una lista.")

    return normalize_config_list(data)
