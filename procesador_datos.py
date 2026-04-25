import argparse
import json
import re
from collections import Counter
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple


DEFAULT_INPUT = Path("data/barberias.json")
DEFAULT_OUTPUT = Path("datos_procesados.json")
UNKNOWN_VALUE = "Desconocido"
MAPS_URL_FIELDS = ("url_maps", "google_maps_url")
CITY_KEYS = ("ciudad", "comuna", "municipio", "localidad")
REGION_KEYS = ("region", "región")
CATEGORY_KEYS = ("keyword", "categoria", "categoría")

CHILE_REGIONS = (
    "Arica y Parinacota",
    "Tarapacá",
    "Antofagasta",
    "Atacama",
    "Coquimbo",
    "Valparaíso",
    "Metropolitana de Santiago",
    "Libertador General Bernardo O'Higgins",
    "Maule",
    "Ñuble",
    "Biobío",
    "La Araucanía",
    "Los Ríos",
    "Los Lagos",
    "Aysén",
    "Magallanes y de la Antártica Chilena",
)

KNOWN_CITIES = (
    "Valparaíso",
    "Viña del Mar",
    "Quilpué",
    "Villa Alemana",
    "Concón",
    "Quintero",
    "Puchuncaví",
    "Casablanca",
    "Limache",
    "Olmué",
    "Placilla",
    "Quillota",
    "La Calera",
    "La Cruz",
    "Hijuelas",
    "Nogales",
    "San Antonio",
    "Cartagena",
    "El Quisco",
    "El Tabo",
    "Algarrobo",
    "Santo Domingo",
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Procesa el JSON crudo del scraper y lo deja listo para la interfaz."
    )
    parser.add_argument(
        "input_file",
        nargs="?",
        default=str(DEFAULT_INPUT),
        help="Ruta al JSON generado por el scraper.",
    )
    parser.add_argument(
        "--output",
        default=str(DEFAULT_OUTPUT),
        help="Ruta de salida para el JSON procesado.",
    )
    parser.add_argument(
        "--keyword",
        default="",
        help="Keyword/categoría reservada para futuros filtros.",
    )
    return parser.parse_args()


def load_raw_data(input_path: Path) -> List[Dict[str, Any]]:
    with input_path.open("r", encoding="utf-8") as file:
        data = json.load(file)

    if not isinstance(data, list):
        raise ValueError("El JSON de entrada debe ser una lista de negocios.")

    normalized_rows: List[Dict[str, Any]] = []
    for index, item in enumerate(data):
        if not isinstance(item, dict):
            raise ValueError(f"El elemento en la posición {index} no es un objeto JSON válido.")
        normalized_rows.append(item)

    return normalized_rows


def clean_scalar(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip()
    return str(value).strip()


def clean_record(record: Dict[str, Any]) -> Dict[str, str]:
    cleaned = {clean_scalar(key): clean_scalar(value) for key, value in record.items()}
    return {key: value for key, value in cleaned.items() if key}


def get_first_non_empty(record: Dict[str, str], keys: Iterable[str]) -> str:
    for key in keys:
        value = record.get(key, "")
        if value:
            return value
    return ""


def normalize_text_for_lookup(value: str) -> str:
    return re.sub(r"\s+", " ", clean_scalar(value)).casefold()


def normalize_phone(value: str) -> str:
    return re.sub(r"\s+", " ", clean_scalar(value)).strip()


def normalize_instagram_url(value: str) -> Optional[str]:
    url = clean_scalar(value)
    if not url:
        return None

    normalized_url = url.split("?", 1)[0].rstrip("/")
    if "instagram.com" not in normalized_url.casefold():
        return None

    return normalized_url


def normalize_email(value: str) -> Optional[str]:
    email = clean_scalar(value)
    if not email or "@" not in email:
        return None
    return email


def detect_region_from_text(text: str) -> str:
    normalized_text = normalize_text_for_lookup(text)
    for region in CHILE_REGIONS:
        if normalize_text_for_lookup(region) in normalized_text:
            return region
    return ""


def detect_city_from_text(text: str) -> str:
    normalized_text = normalize_text_for_lookup(text)
    for city in KNOWN_CITIES:
        if normalize_text_for_lookup(city) in normalized_text:
            return city
    return ""


def infer_location(record: Dict[str, str]) -> Tuple[str, str]:
    city = get_first_non_empty(record, CITY_KEYS)
    region = get_first_non_empty(record, REGION_KEYS)

    if city and region:
        return city, region

    sources = [
        record.get("direccion", ""),
        record.get("nombre", ""),
        get_first_non_empty(record, MAPS_URL_FIELDS),
    ]
    searchable_text = " | ".join(source for source in sources if source)

    if not city:
        city = detect_city_from_text(searchable_text)

    if not region:
        region = detect_region_from_text(searchable_text)

    return city or UNKNOWN_VALUE, region or UNKNOWN_VALUE


def build_unique_id(record: Dict[str, str]) -> str:
    maps_url = get_first_non_empty(record, MAPS_URL_FIELDS)
    if maps_url:
        return maps_url

    fallback_fields = (
        record.get("nombre", ""),
        record.get("direccion", ""),
        record.get("telefono", ""),
    )
    return "|".join(fallback_fields)


def apply_future_filters(record: Dict[str, str], keyword: str = "") -> bool:
    if not keyword:
        return True

    keyword_norm = normalize_text_for_lookup(keyword)
    category_text = get_first_non_empty(record, CATEGORY_KEYS)
    searchable_text = " ".join(
        [
            record.get("nombre", ""),
            record.get("direccion", ""),
            category_text,
        ]
    )
    return keyword_norm in normalize_text_for_lookup(searchable_text)


def deduplicate_records(records: Iterable[Dict[str, Any]]) -> List[Dict[str, Any]]:
    unique_records: List[Dict[str, Any]] = []
    seen_ids = set()

    for record in records:
        unique_id = build_unique_id(record)
        if unique_id in seen_ids:
            continue
        seen_ids.add(unique_id)
        unique_records.append(record)

    return unique_records


def normalize_records(records: List[Dict[str, Any]], keyword: str = "") -> List[Dict[str, Any]]:
    processed: List[Dict[str, Any]] = []

    for raw_record in records:
        record = clean_record(raw_record)
        city, region = infer_location(record)

        record["nombre"] = clean_scalar(record.get("nombre", ""))
        record["ciudad"] = clean_scalar(city or UNKNOWN_VALUE)
        record["region"] = clean_scalar(region or UNKNOWN_VALUE)
        record["telefono"] = normalize_phone(record.get("telefono", ""))
        record["instagram"] = normalize_instagram_url(record.get("instagram", "") or record.get("web", ""))
        record["email"] = normalize_email(record.get("email", ""))

        maps_url = get_first_non_empty(record, MAPS_URL_FIELDS)
        if maps_url:
            record["url_maps"] = maps_url
            record["google_maps_url"] = maps_url

        # Estructura mínima estable para el frontend.
        record.setdefault("telefono", "")
        record.setdefault("nombre", "")
        record.setdefault("ciudad", UNKNOWN_VALUE)
        record.setdefault("instagram", None)
        record.setdefault("email", None)

        if apply_future_filters(record, keyword=keyword):
            processed.append(record)

    return processed


def group_by_region_and_city(records: Iterable[Dict[str, Any]]) -> Dict[str, Dict[str, List[Dict[str, Any]]]]:
    grouped: Dict[str, Dict[str, List[Dict[str, Any]]]] = {}

    for record in records:
        region = record.get("region", UNKNOWN_VALUE) or UNKNOWN_VALUE
        city = record.get("ciudad", UNKNOWN_VALUE) or UNKNOWN_VALUE
        grouped.setdefault(region, {}).setdefault(city, []).append(record)

    return grouped


def save_processed_data(data: Dict[str, Dict[str, List[Dict[str, Any]]]], output_path: Path) -> None:
    with output_path.open("w", encoding="utf-8") as file:
        json.dump(data, file, ensure_ascii=False, indent=2)


def print_logs(total_original: int, unique_records: List[Dict[str, Any]]) -> None:
    city_counts = Counter(record.get("ciudad", UNKNOWN_VALUE) or UNKNOWN_VALUE for record in unique_records)
    detected_cities = sorted(city_counts)

    print(f"Total originales: {total_original}")
    print(f"Total únicos: {len(unique_records)}")
    print(f"Ciudades detectadas: {', '.join(detected_cities) if detected_cities else 'Ninguna'}")

    for city in detected_cities:
        print(f"Total en {city}: {city_counts[city]}")


def process_file(input_path: Path, output_path: Path, keyword: str = "") -> None:
    raw_data = load_raw_data(input_path)
    normalized_records = normalize_records(raw_data, keyword=keyword)
    unique_records = deduplicate_records(normalized_records)
    grouped_data = group_by_region_and_city(unique_records)

    save_processed_data(grouped_data, output_path)
    print_logs(total_original=len(raw_data), unique_records=unique_records)
    print(f"Archivo generado: {output_path}")


def main() -> None:
    args = parse_args()
    input_path = Path(args.input_file)
    output_path = Path(args.output)
    process_file(input_path=input_path, output_path=output_path, keyword=args.keyword)


if __name__ == "__main__":
    main()
