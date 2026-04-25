import json
import logging
from pathlib import Path
from typing import Any

from backend.services.config_service import get_ciudades
from backend.services.scraper_service import build_city_output_file, build_region_processed_file


logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parents[2]


def load_records(path: Path) -> list[dict[str, Any]]:
    with path.open("r", encoding="utf-8") as file:
        data = json.load(file)

    if not isinstance(data, list):
        raise ValueError(f"El archivo {path.name} no contiene una lista válida.")

    return [record for record in data if isinstance(record, dict)]


def build_dedupe_key(record: dict[str, Any]) -> tuple[str, str]:
    nombre = str(record.get("nombre", "")).strip().casefold()
    direccion = str(record.get("direccion", "")).strip().casefold()
    return nombre, direccion


def deduplicate_records(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    unique_records: list[dict[str, Any]] = []
    seen = set()

    for record in records:
        key = build_dedupe_key(record)
        if key in seen:
            continue
        seen.add(key)
        unique_records.append(record)

    return unique_records


def process_region(region: str) -> dict:
    region = region.strip()
    ciudades = get_ciudades(region)
    combined_records: list[dict[str, Any]] = []
    loaded_files: list[str] = []
    missing_files: list[str] = []

    logger.info("Inicio procesamiento region=%s", region)

    for ciudad in ciudades:
        city_file = build_city_output_file(ciudad)
        if not city_file.exists():
            missing_files.append(city_file.name)
            continue

        logger.info("Cargando archivo raw city=%s file=%s", ciudad, city_file.name)
        combined_records.extend(load_records(city_file))
        loaded_files.append(city_file.name)

    unique_records = deduplicate_records(combined_records)
    output_file = build_region_processed_file(region)
    output_file.parent.mkdir(parents=True, exist_ok=True)

    with output_file.open("w", encoding="utf-8") as file:
        json.dump(unique_records, file, ensure_ascii=False, indent=2)

    logger.info("Fin procesamiento region=%s total=%s", region, len(unique_records))

    return {
        "status": "processed",
        "region": region,
        "total": len(unique_records),
        "file": str(output_file.relative_to(BASE_DIR)),
        "sources": loaded_files,
        "missing": missing_files,
    }
