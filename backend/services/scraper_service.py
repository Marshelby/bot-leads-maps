import logging
import re
import subprocess
import unicodedata
from pathlib import Path


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
output_file = Path(sys.argv[3])
query = f"{niche} en {city}, Chile"

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


def run_scraper(city: str, niche: str) -> dict:
    city = city.strip()
    niche = niche.strip()
    output_file = build_city_output_file(city, niche=niche)
    command = ["python3", "-c", SCRAPER_RUNNER, city, niche, str(output_file)]

    logger.info("Inicio scraping niche=%s city=%s", niche, city)
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
        logger.exception("Fallo scraping niche=%s city=%s", niche, city)
        raise RuntimeError(
            f"No se pudo ejecutar el scraper para '{niche}' en la ciudad '{city}'. {error_output}"
        ) from error

    if result.stdout:
        logger.info(result.stdout.strip())
    if result.stderr:
        logger.warning(result.stderr.strip())

    logger.info("Fin scraping niche=%s city=%s", niche, city)

    return {
        "status": "completed",
        "city": city,
        "niche": niche,
        "file": str(output_file.relative_to(BASE_DIR)),
    }
