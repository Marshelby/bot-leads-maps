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
UI_REGIONS_FILE = BASE_DIR / "public" / "regiones_config.json"
UI_CITIES_FILE = BASE_DIR / "public" / "ciudades_config.json"

REGION_SOURCE_ALIASES = {
    "arica": "Arica y Parinacota",
    "santiago": "Región Metropolitana",
}


def slugify(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value.strip())
    ascii_only = normalized.encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-z0-9]+", "_", ascii_only.lower()).strip("_")
    return slug or "desconocido"


def load_json_file(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as file:
        return json.load(file)


def load_ui_regions() -> list[str]:
    data = load_json_file(UI_REGIONS_FILE)
    if not isinstance(data, list):
        raise ValueError(f"{UI_REGIONS_FILE.relative_to(BASE_DIR)} debe contener una lista de regiones.")

    regions: list[str] = []
    for index, item in enumerate(data):
        value = str(item).strip()
        if not value:
            raise ValueError(f"La región en la posición {index} de {UI_REGIONS_FILE.name} está vacía.")
        regions.append(value)

    return regions


def load_ui_cities() -> dict[str, list[str]]:
    data = load_json_file(UI_CITIES_FILE)
    if not isinstance(data, dict):
        raise ValueError(f"{UI_CITIES_FILE.relative_to(BASE_DIR)} debe contener un mapa por región.")

    normalized: dict[str, list[str]] = {}
    for region, cities in data.items():
        region_name = str(region).strip()
        if not region_name:
            raise ValueError(f"Se encontró una región vacía en {UI_CITIES_FILE.name}.")
        if not isinstance(cities, list):
            raise ValueError(f"La región '{region_name}' en {UI_CITIES_FILE.name} debe mapear a una lista.")

        normalized[region_name] = [str(city).strip() for city in cities if str(city).strip()]

    return normalized


def build_region_lookup(ui_regions: list[str]) -> dict[str, str]:
    lookup = {slugify(region): region for region in ui_regions}

    for source_slug, canonical_name in REGION_SOURCE_ALIASES.items():
        if canonical_name not in ui_regions:
            raise ValueError(
                f"La región canónica '{canonical_name}' no existe en {UI_REGIONS_FILE.relative_to(BASE_DIR)}."
            )
        lookup[source_slug] = canonical_name

    return lookup


def ensure_input_dir() -> list[Path]:
    if not INPUT_DIR.exists():
        raise FileNotFoundError(f"No existe la carpeta de entrada: {INPUT_DIR}")

    region_dirs = sorted(path for path in INPUT_DIR.iterdir() if path.is_dir())
    if not region_dirs:
        raise FileNotFoundError(f"No se encontraron regiones en: {INPUT_DIR}")

    return region_dirs


def load_region_records(region_dir: Path) -> tuple[list[dict[str, Any]], list[Path]]:
    records: list[dict[str, Any]] = []
    json_files = sorted(region_dir.glob("*.json"))

    if not json_files:
        raise FileNotFoundError(f"La carpeta {region_dir.relative_to(BASE_DIR)} no contiene archivos JSON.")

    for json_file in json_files:
        data = load_json_file(json_file)

        if not isinstance(data, list):
            raise ValueError(f"El archivo {json_file.relative_to(BASE_DIR)} no contiene una lista de negocios.")

        for index, item in enumerate(data):
            if not isinstance(item, dict):
                raise ValueError(
                    f"El elemento {index} en {json_file.relative_to(BASE_DIR)} no es un objeto JSON válido."
                )
            records.append(item)

    return records, json_files


def canonical_region_name(region_dir: Path, region_lookup: dict[str, str]) -> str:
    source_slug = slugify(region_dir.name)
    canonical_name = region_lookup.get(source_slug)
    if canonical_name:
        return canonical_name

    raise ValueError(
        "No existe una región canónica configurada para "
        f"'{region_dir.name}'. Revisa {UI_REGIONS_FILE.relative_to(BASE_DIR)} y el mapping del pipeline."
    )


def prepare_output_dir(output_dir: Path) -> list[Path]:
    output_dir.mkdir(parents=True, exist_ok=True)
    existing_files = sorted(output_dir.glob("*.json"))
    for path in existing_files:
        path.unlink()
    return existing_files


def process_region(
    region_dir: Path,
    output_dir: Path,
    region_lookup: dict[str, str],
) -> dict[str, Any]:
    ui_region_name = canonical_region_name(region_dir, region_lookup)
    raw_records, json_files = load_region_records(region_dir)
    normalized_records = normalize_records(raw_records)

    for record in normalized_records:
        record["region"] = ui_region_name

    unique_records = deduplicate_records(normalized_records)
    grouped_data = group_by_region_and_city(unique_records)

    output_file = output_dir / f"{slugify(ui_region_name)}.json"
    save_processed_data(grouped_data, output_file)

    cities = sorted({city for region_cities in grouped_data.values() for city in region_cities.keys()})
    raw_leads = len(raw_records)
    final_leads = len(unique_records)

    return {
        "source_region": region_dir.name,
        "ui_region": ui_region_name,
        "json_files": json_files,
        "raw_leads": raw_leads,
        "duplicates_removed": raw_leads - final_leads,
        "final_leads": final_leads,
        "cities": cities,
        "output_file": output_file,
    }


def validate_generated_outputs(
    summaries: list[dict[str, Any]],
    ui_regions: list[str],
    ui_cities: dict[str, list[str]],
) -> dict[str, Any]:
    generated_files = {summary["output_file"].stem: summary for summary in summaries}
    expected_region_slugs = {slugify(region): region for region in ui_regions}

    missing_regions = [region for region in ui_regions if slugify(region) not in generated_files]
    orphan_files = sorted(stem for stem in generated_files if stem not in expected_region_slugs)
    structure_errors: list[str] = []
    missing_city_configs: list[str] = []
    city_config_warnings: list[str] = []

    for summary in summaries:
        output_file = summary["output_file"]
        data = load_json_file(output_file)

        if not isinstance(data, dict):
            structure_errors.append(
                f"{output_file.relative_to(BASE_DIR)} no contiene un objeto región -> ciudad -> leads."
            )
            continue

        if len(data) != 1:
            structure_errors.append(
                f"{output_file.relative_to(BASE_DIR)} debe contener una sola región raíz y contiene {len(data)}."
            )
            continue

        region_name, region_cities = next(iter(data.items()))
        if region_name != summary["ui_region"]:
            structure_errors.append(
                f"{output_file.relative_to(BASE_DIR)} usa la región raíz '{region_name}' "
                f"pero debería usar '{summary['ui_region']}'."
            )

        if slugify(region_name) != output_file.stem:
            structure_errors.append(
                f"{output_file.relative_to(BASE_DIR)} no coincide con el slug esperado de '{region_name}'."
            )

        if not isinstance(region_cities, dict):
            structure_errors.append(
                f"{output_file.relative_to(BASE_DIR)} no contiene un mapa válido de ciudades."
            )
            continue

        for city_name, leads in region_cities.items():
            if not isinstance(leads, list):
                structure_errors.append(
                    f"{output_file.relative_to(BASE_DIR)} contiene una ciudad inválida: '{city_name}'."
                )

        expected_cities = ui_cities.get(summary["ui_region"])
        if expected_cities is None:
            missing_city_configs.append(summary["ui_region"])
            continue

        actual_cities = summary["cities"]
        unexpected_cities = sorted(city for city in actual_cities if city not in expected_cities)
        config_cities_without_leads = sorted(city for city in expected_cities if city not in actual_cities)

        if unexpected_cities:
            city_config_warnings.append(
                f"{summary['ui_region']}: ciudades no presentes en ciudades_config.json -> "
                + ", ".join(unexpected_cities)
            )

        if config_cities_without_leads:
            city_config_warnings.append(
                f"{summary['ui_region']}: ciudades configuradas sin leads en el dataset -> "
                + ", ".join(config_cities_without_leads)
            )

    return {
        "missing_regions": missing_regions,
        "orphan_files": orphan_files,
        "structure_errors": structure_errors,
        "missing_city_configs": sorted(missing_city_configs),
        "city_config_warnings": city_config_warnings,
    }


def print_report(
    *,
    summaries: list[dict[str, Any]],
    validation: dict[str, Any],
    removed_files: list[Path],
    region_dirs: list[Path],
) -> None:
    total_raw_files = sum(len(summary["json_files"]) for summary in summaries)
    total_raw_leads = sum(summary["raw_leads"] for summary in summaries)
    total_duplicates_removed = sum(summary["duplicates_removed"] for summary in summaries)
    total_final_leads = sum(summary["final_leads"] for summary in summaries)
    generated_files = [summary["output_file"].relative_to(BASE_DIR) for summary in summaries]

    has_fatal_errors = bool(
        validation["missing_regions"]
        or validation["orphan_files"]
        or validation["structure_errors"]
        or validation["missing_city_configs"]
    )
    has_warnings = bool(validation["city_config_warnings"])

    if has_fatal_errors:
        final_status = "ERROR"
    elif has_warnings:
        final_status = "LISTO CON ADVERTENCIAS"
    else:
        final_status = "LISTO"

    print()
    print("## Pipeline de leads - Chile completo")
    print()
    print(f"Regiones detectadas: {len(region_dirs)}")
    print(f"Regiones procesadas: {len(summaries)}")
    print(f"Archivos JSON leídos: {total_raw_files}")
    print(f"Leads crudos: {total_raw_leads}")
    print(f"Duplicados eliminados: {total_duplicates_removed}")
    print(f"Leads finales: {total_final_leads}")
    print(f"Archivos generados: {len(generated_files)}")
    print()
    print("Validaciones:")
    print(f"- Regiones UI: {'OK' if not validation['missing_regions'] else 'ERROR'}")
    print(f"- Archivos generados: {'OK' if not validation['orphan_files'] else 'ERROR'}")
    print(
        "- Compatibilidad DirectoryPage: "
        f"{'OK' if not validation['structure_errors'] and not validation['missing_regions'] and not validation['orphan_files'] else 'ERROR'}"
    )
    print(
        "- Compatibilidad ciudades_config.json: "
        f"{'OK' if not validation['missing_city_configs'] and not validation['city_config_warnings'] else 'ADVERTENCIAS'}"
    )
    print()

    if removed_files:
        print("Archivos anteriores reemplazados:")
        for path in removed_files:
            print(f"- {path.relative_to(BASE_DIR)}")
        print()

    print("Archivos generados:")
    for path in generated_files:
        print(f"- {path}")
    print()

    if validation["missing_regions"]:
        print("Regiones faltantes para la UI:")
        for region in validation["missing_regions"]:
            print(f"- {region}")
        print()

    if validation["orphan_files"]:
        print("Archivos huérfanos generados:")
        for stem in validation["orphan_files"]:
            print(f"- public/regiones/{stem}.json")
        print()

    if validation["missing_city_configs"]:
        print("Regiones sin configuración de ciudades:")
        for region in validation["missing_city_configs"]:
            print(f"- {region}")
        print()

    if validation["structure_errors"]:
        print("Errores de estructura:")
        for error in validation["structure_errors"]:
            print(f"- {error}")
        print()

    if validation["city_config_warnings"]:
        print("Advertencias de ciudades:")
        for warning in validation["city_config_warnings"]:
            print(f"- {warning}")
        print()

    print(f"Estado final: {final_status}")


def main() -> None:
    region_dirs = ensure_input_dir()
    ui_regions = load_ui_regions()
    ui_cities = load_ui_cities()
    region_lookup = build_region_lookup(ui_regions)
    removed_files = prepare_output_dir(OUTPUT_DIR)

    summaries: list[dict[str, Any]] = []
    for region_dir in region_dirs:
        summaries.append(process_region(region_dir, OUTPUT_DIR, region_lookup))

    validation = validate_generated_outputs(summaries, ui_regions, ui_cities)
    print_report(
        summaries=summaries,
        validation=validation,
        removed_files=removed_files,
        region_dirs=region_dirs,
    )

    has_fatal_errors = bool(
        validation["missing_regions"]
        or validation["orphan_files"]
        or validation["structure_errors"]
        or validation["missing_city_configs"]
    )
    if has_fatal_errors:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
