import json
import logging
import re
import subprocess
import unicodedata
from pathlib import Path

from backend.services.config_service import DEFAULT_COUNTRY, get_ciudades, get_country, get_region


logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parents[2]
SCRAPER_SCRIPT = BASE_DIR / "bot_scraper" / "scraper_maps.py"
DATA_DIR = BASE_DIR / "data"
SCRAPER_RUNNER = """
import sys
from pathlib import Path

import bot_scraper.scraper_maps as scraper

city = sys.argv[1].strip()
niche = sys.argv[2].strip()
country = sys.argv[3].strip()
output_file = Path(sys.argv[4])
query = f"{niche} en {city}, {country}"

driver = None
try:
    driver = scraper.iniciar_driver()
    wait = scraper.WebDriverWait(driver, scraper.WAIT_TIMEOUT)

    scraper.buscar_barberias(driver, wait, query=query)
    urls = scraper.recolectar_urls_negocios(driver, wait, max_results=scraper.MAX_RESULTS)
    scraper.log(f"Total URLs recolectadas: {len(urls)}")

    resultados = scraper.procesar_urls_negocios(driver, wait, urls)
    scraper.guardar_json(resultados, output_file=output_file)

    scraper.log(f"Total negocios procesados: {len(urls[:scraper.MAX_RESULTS])}")
    scraper.log(f"Total guardados: {len(resultados)}")
finally:
    if driver is not None:
        driver.quit()
"""


def normalize_location_slug(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value.strip())
    ascii_only = normalized.encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-z0-9]+", "_", ascii_only.lower()).strip("_")
    return slug or "desconocido"


def build_city_output_file(city: str, niche: str = "barberia") -> Path:
    return DATA_DIR / f"{normalize_location_slug(niche)}_{normalize_location_slug(city)}.json"


def build_region_processed_file(region: str, niche: str = "barberia") -> Path:
    return DATA_DIR / f"{normalize_location_slug(niche)}_{normalize_location_slug(region)}_full.json"


def count_output_records(output_file: Path) -> int:
    if not output_file.exists():
        return 0

    with output_file.open("r", encoding="utf-8") as file:
        data = json.load(file)

    if not isinstance(data, list):
        return 0

    return len(data)


def run_scraper(city: str, niche: str, country: str = DEFAULT_COUNTRY) -> dict:
    country_data = get_country(country)
    city = city.strip()
    niche = niche.strip()
    if not city:
      raise ValueError("La ciudad es obligatoria.")
    if not niche:
      raise ValueError("El nicho es obligatorio.")

    output_file = build_city_output_file(city, niche=niche)
    command = ["python3", "-c", SCRAPER_RUNNER, city, niche, country_data["label"], str(output_file)]

    logger.info("Inicio scraping country=%s niche=%s city=%s", country_data["id"], niche, city)
    logger.info("Ejecutando comando: %s", " ".join(command))

    try:
        result = subprocess.run(
            command,
            cwd=str(BASE_DIR),
            capture_output=True,
            text=True,
            check=True,
        )
    except subprocess.CalledProcessError as error:
        error_output = (error.stderr or error.stdout or "").strip()
        logger.exception("Fallo scraping country=%s niche=%s city=%s", country_data["id"], niche, city)
        raise RuntimeError(
            f"No se pudo ejecutar el scraper para '{niche}' en la ciudad '{city}'. {error_output}"
        ) from error

    if result.stdout:
        logger.info(result.stdout.strip())
    if result.stderr:
        logger.warning(result.stderr.strip())

    total = count_output_records(output_file)
    logger.info("Fin scraping country=%s niche=%s city=%s total=%s", country_data["id"], niche, city, total)

    return {
        "status": "completed",
        "mode": "city",
        "country": country_data["id"],
        "country_label": country_data["label"],
        "city": city,
        "niche": niche,
        "total": total,
        "file": str(output_file.relative_to(BASE_DIR)),
    }


def run_region_scraper(region: str, niche: str, country: str = DEFAULT_COUNTRY) -> dict:
    country_data = get_country(country)
    region_data = get_region(country, region)
    niche = niche.strip()
    if not niche:
        raise ValueError("El nicho es obligatorio.")

    cities = get_ciudades(region_data["label"], country=country_data["id"])
    if not cities:
        raise ValueError(
            f"La región '{region_data['label']}' del país '{country_data['label']}' no tiene ciudades configuradas."
        )

    city_results: list[dict] = []
    success_count = 0
    failure_count = 0
    total_leads = 0

    logger.info(
        "Inicio scraping regional country=%s region=%s niche=%s ciudades=%s",
        country_data["id"],
        region_data["label"],
        niche,
        len(cities),
    )

    for city in cities:
        try:
            result = run_scraper(city=city, niche=niche, country=country_data["id"])
            city_results.append({
                "city": city,
                "status": "completed",
                "total": result["total"],
                "file": result["file"],
            })
            success_count += 1
            total_leads += result["total"]
        except Exception as error:  # noqa: BLE001
            logger.exception(
                "Fallo parcial scraping regional country=%s region=%s city=%s niche=%s",
                country_data["id"],
                region_data["label"],
                city,
                niche,
            )
            city_results.append({
                "city": city,
                "status": "error",
                "error": str(error),
            })
            failure_count += 1

    status = "completed" if failure_count == 0 else "completed_with_errors"
    generated_files = [item["file"] for item in city_results if item.get("status") == "completed"]

    logger.info(
        "Fin scraping regional country=%s region=%s niche=%s success=%s errors=%s total=%s",
        country_data["id"],
        region_data["label"],
        niche,
        success_count,
        failure_count,
        total_leads,
    )

    return {
        "status": status,
        "mode": "region",
        "country": country_data["id"],
        "country_label": country_data["label"],
        "region": region_data["label"],
        "region_id": region_data["id"],
        "niche": niche,
        "cities_processed": len(cities),
        "cities_successful": success_count,
        "cities_with_error": failure_count,
        "total": total_leads,
        "files": generated_files,
        "results": city_results,
    }
