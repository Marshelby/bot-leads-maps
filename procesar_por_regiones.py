import json
import re
import unicodedata
from pathlib import Path
from typing import Any

from procesador_datos import (
    deduplicate_records,
    group_by_region_and_city,
    normalize_records,
    save_processed_data,
)


BASE_DIR = Path(__file__).resolve().parent
INPUT_DIR = BASE_DIR / "data" / "barberias"
OUTPUT_DIR = BASE_DIR / "public" / "regiones"


def slugify(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value.strip())
    ascii_only = normalized.encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-z0-9]+", "_", ascii_only.lower()).strip("_")
    return slug or "desconocido"


def load_region_records(region_dir: Path) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []

    for json_file in sorted(region_dir.glob("*.json")):
        with json_file.open("r", encoding="utf-8") as file:
            data = json.load(file)

        if not isinstance(data, list):
            raise ValueError(f"El archivo {json_file} no contiene una lista de negocios.")

        for index, item in enumerate(data):
            if not isinstance(item, dict):
                raise ValueError(
                    f"El elemento {index} en {json_file} no es un objeto JSON válido."
                )
            records.append(item)

    return records


def process_region(region_dir: Path, output_dir: Path) -> Path:
    raw_records = load_region_records(region_dir)
    normalized_records = normalize_records(raw_records)
    unique_records = deduplicate_records(normalized_records)
    grouped_data = group_by_region_and_city(unique_records)

    output_dir.mkdir(parents=True, exist_ok=True)
    output_file = output_dir / f"{slugify(region_dir.name)}.json"
    save_processed_data(grouped_data, output_file)
    return output_file


def main() -> None:
    if not INPUT_DIR.exists():
        raise FileNotFoundError(f"No existe la carpeta de entrada: {INPUT_DIR}")

    region_dirs = sorted(path for path in INPUT_DIR.iterdir() if path.is_dir())
    if not region_dirs:
        raise FileNotFoundError(f"No se encontraron regiones en: {INPUT_DIR}")

    for region_dir in region_dirs:
        output_file = process_region(region_dir, OUTPUT_DIR)
        print(f"Archivo generado: {output_file.relative_to(BASE_DIR)}")


if __name__ == "__main__":
    main()
