import argparse
import json
import random
import re
import unicodedata
from pathlib import Path
from time import sleep
from typing import Dict, List, Optional, Set

from selenium import webdriver
from selenium.common.exceptions import NoSuchElementException, TimeoutException, WebDriverException
from selenium.webdriver import Chrome
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.remote.webelement import WebElement
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait
from webdriver_manager.chrome import ChromeDriverManager


BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"

MAPS_URL = "https://www.google.com/maps"
DEFAULT_REGION = "Valparaíso"
MAX_RESULTS = 300
WAIT_TIMEOUT = 20
SCROLL_PAUSE_SECONDS = 2
DETAIL_PAUSE_SECONDS = (1, 2)
MAX_SCROLL_WITHOUT_NEW_URLS = 3
CIUDADES_V_REGION = [
    "Valparaíso",
    "Viña del Mar",
    "Quilpué",
    "Villa Alemana",
    "Concón",
    "Quillota",
    "La Calera",
    "Limache",
]


def log(message: str) -> None:
    print(message, flush=True)


def human_delay(min_seconds: int = 1, max_seconds: int = 2) -> None:
    sleep(random.uniform(min_seconds, max_seconds))


def iniciar_driver() -> Chrome:
    options = Options()
    options.add_argument("--start-maximized")
    options.add_argument("--lang=es-CL")
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    options.add_experimental_option("useAutomationExtension", False)

    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=options)
    driver.execute_script(
        """
        Object.defineProperty(navigator, 'webdriver', {
            get: () => undefined
        });
        """
    )
    return driver


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Scrapea barberías de Google Maps para una región de Chile."
    )
    parser.add_argument(
        "region",
        nargs="?",
        default=DEFAULT_REGION,
        help="Región de Chile a buscar. Ejemplo: Valparaíso o Región Metropolitana.",
    )
    return parser.parse_args()


def build_query(region: str) -> str:
    return f"barbería en {limpiar_texto(region)}, Chile"


def normalize_region_slug(region: str) -> str:
    normalized = unicodedata.normalize("NFKD", limpiar_texto(region))
    ascii_only = normalized.encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-z0-9]+", "_", ascii_only.lower()).strip("_")
    return slug or "desconocido"


def build_output_file(region: str) -> Path:
    return DATA_DIR / f"barberia_{normalize_region_slug(region)}.json"


def buscar_barberias(driver: Chrome, wait: WebDriverWait, query: str) -> None:
    log(f"Buscando {query}...")
    url = f"{MAPS_URL}/search/{query.replace(' ', '+')}"
    driver.get(url)
    sleep(5)
    wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, '[role="feed"]')))
    log("Resultados cargados correctamente desde URL")


def obtener_feed(driver: Chrome, wait: WebDriverWait) -> WebElement:
    return wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, '[role="feed"]')))


def recolectar_urls_visibles(driver: Chrome) -> Set[str]:
    urls: Set[str] = set()
    anchors = driver.find_elements(By.CSS_SELECTOR, 'a.hfpxzc')

    for anchor in anchors:
        href = (anchor.get_attribute("href") or "").strip()
        if "/place/" in href and href not in urls:
            urls.add(href)

    return urls


def recolectar_urls_negocios(
    driver: Chrome,
    wait: WebDriverWait,
    max_results: int = MAX_RESULTS,
) -> List[str]:
    feed = obtener_feed(driver, wait)
    urls_recolectadas: Set[str] = set()
    scrolls_sin_nuevas = 0

    while scrolls_sin_nuevas < MAX_SCROLL_WITHOUT_NEW_URLS and len(urls_recolectadas) < max_results:
        urls_antes = len(urls_recolectadas)
        urls_visibles = recolectar_urls_visibles(driver)

        for url in urls_visibles:
            if url not in urls_recolectadas:
                urls_recolectadas.add(url)
                log(f"URL recolectada: {url}")
                if len(urls_recolectadas) >= max_results:
                    break

        if len(urls_recolectadas) == urls_antes:
            scrolls_sin_nuevas += 1
        else:
            scrolls_sin_nuevas = 0

        driver.execute_script(
            "arguments[0].scrollTop = arguments[0].scrollHeight",
            feed,
        )
        sleep(SCROLL_PAUSE_SECONDS)

    return list(urls_recolectadas)


def limpiar_texto(value: Optional[str]) -> str:
    if not value:
        return ""
    return re.sub(r"\s+", " ", value).strip()


def normalizar_instagram_url(url: str) -> str:
    url_limpia = limpiar_texto(url)
    if not url_limpia:
        return ""

    url_sin_parametros = url_limpia.split("?", 1)[0].rstrip("/")
    if "instagram.com" not in url_sin_parametros.lower():
        return ""

    return url_sin_parametros


def extraer_texto_css(driver: Chrome, selector: str) -> str:
    try:
        return limpiar_texto(driver.find_element(By.CSS_SELECTOR, selector).text)
    except NoSuchElementException:
        return ""


def extraer_texto_xpath(driver: Chrome, xpath: str) -> str:
    try:
        return limpiar_texto(driver.find_element(By.XPATH, xpath).text)
    except NoSuchElementException:
        return ""


def extraer_atributo_css(driver: Chrome, selector: str, attribute: str) -> str:
    try:
        return limpiar_texto(driver.find_element(By.CSS_SELECTOR, selector).get_attribute(attribute))
    except NoSuchElementException:
        return ""


def extraer_atributo_xpath(driver: Chrome, xpath: str, attribute: str) -> str:
    try:
        return limpiar_texto(driver.find_element(By.XPATH, xpath).get_attribute(attribute))
    except NoSuchElementException:
        return ""


def esperar_detalle_negocio(
    driver: Chrome,
    wait: WebDriverWait,
    previous_name: str = "",
) -> None:
    def detalle_cargado(current_driver: Chrome) -> bool:
        nombre = extraer_texto_xpath(
            current_driver,
            '//h1[contains(@class, "DUwDvf") or @role="heading"]',
        )
        if not nombre:
            return False
        if previous_name and nombre == previous_name:
            return False
        return True

    wait.until(lambda current_driver: detalle_cargado(current_driver))


def extraer_direccion(driver: Chrome) -> str:
    direccion = (
        extraer_atributo_css(driver, 'button[data-item-id="address"]', "aria-label")
        or extraer_texto_css(driver, 'button[data-item-id="address"]')
        or extraer_texto_xpath(
            driver,
            '//button[@data-item-id="address"]//div[contains(@class, "fontBodyMedium")]',
        )
        or extraer_texto_xpath(
            driver,
            '//button[@data-item-id="address"]',
        )
        or ""
    )
    return re.sub(r"^(Dirección|Address):\s*", "", direccion, flags=re.IGNORECASE)


def extraer_telefono(driver: Chrome) -> str:
    return (
        extraer_texto_css(driver, 'button[data-item-id^="phone"]')
        or extraer_texto_xpath(
            driver,
            '//button[starts-with(@data-item-id, "phone")]//div[contains(@class, "fontBodyMedium")]',
        )
        or ""
    )


def extraer_web(driver: Chrome) -> str:
    return (
        extraer_atributo_css(driver, 'a[data-item-id="authority"]', "href")
        or extraer_atributo_xpath(
            driver,
            '//a[contains(@data-item-id, "authority") or contains(@data-item-id, "website")]',
            "href",
        )
        or extraer_atributo_xpath(
            driver,
            '//div[@role="main"]//a[starts-with(@href, "http") and not(contains(@href, "google.com"))]',
            "href",
        )
        or ""
    )


def extraer_rating(driver: Chrome) -> str:
    rating = (
        extraer_atributo_xpath(
            driver,
            '//span[@role="img" and (contains(@aria-label, "stars") or contains(@aria-label, "estrellas"))]',
            "aria-label",
        )
        or ""
    )
    if rating:
        match = re.search(r"\d+[.,]?\d*", rating)
        return match.group(0).replace(",", ".") if match else rating
    return ""


def extraer_nombre(driver: Chrome) -> str:
    return (
        extraer_texto_xpath(
            driver,
            '//h1[contains(@class, "DUwDvf")]',
        )
        or extraer_texto_css(driver, "h1.DUwDvf")
        or extraer_texto_xpath(
            driver,
            '//div[@role="main"]//h1[@role="heading"]',
        )
        or extraer_atributo_xpath(
            driver,
            '//meta[@property="og:title"]',
            "content",
        )
        or ""
    )


def extraer_ciudad_region(direccion: str) -> tuple[str, str]:
    partes = [parte.strip() for parte in direccion.split(",") if parte.strip()]

    region = "Desconocido"
    ciudad = "Desconocido"

    if len(partes) >= 3:
        region_limpia = re.sub(r"\d+", " ", partes[-1])
        region_limpia = re.sub(r"\s+", " ", region_limpia).strip()
        if region_limpia:
            region = region_limpia

        ciudad_limpia = re.sub(r"\d+", " ", partes[-2])
        ciudad_limpia = re.sub(r"\s+", " ", ciudad_limpia).strip()
        if ciudad_limpia:
            ciudad = ciudad_limpia
    elif len(partes) == 2:
        region_limpia = re.sub(r"\d+", " ", partes[-1])
        region_limpia = re.sub(r"\s+", " ", region_limpia).strip()
        if region_limpia:
            region = region_limpia
            ciudad = region_limpia
    elif len(partes) == 1:
        region_limpia = re.sub(r"\d+", " ", partes[0])
        region_limpia = re.sub(r"\s+", " ", region_limpia).strip()
        if region_limpia:
            region = region_limpia
            ciudad = region_limpia

    if not ciudad:
        ciudad = "Desconocido"

    if not region:
        region = "Desconocido"

    print(f"[DEBUG] Dirección: {direccion}")
    print(f"[DEBUG] Partes: {partes}")
    print(f"[DEBUG] Ciudad final: {ciudad}")
    print(f"[DEBUG] Región final: {region}")

    return ciudad, region


def limpiar_telefono(telefono: str) -> str:
    telefono_limpio = re.sub(r"[^0-9+()\s]", " ", telefono)
    return re.sub(r"\s+", " ", telefono_limpio).strip()


def limpiar_ciudad(ciudad: str, region: str) -> str:
    ciudad_limpia = re.sub(r"\d+", " ", ciudad)
    ciudad_limpia = re.sub(r"\s+", " ", ciudad_limpia).strip()

    palabras_basura = ["local", "depto", "departamento", "of", "oficina"]
    ciudad_normalizada = ciudad_limpia.lower()
    if any(palabra in ciudad_normalizada for palabra in palabras_basura):
        return region

    if not ciudad_limpia or len(ciudad_limpia) < 3:
        return region

    return ciudad_limpia


def nombre_valido(nombre: str) -> bool:
    nombre_limpio = nombre.strip()
    if not nombre_limpio:
        return False
    return True


def direccion_valida(direccion: str) -> bool:
    direccion_limpia = direccion.strip()
    if not direccion_limpia:
        return False
    return True


def extraer_datos_negocio(
    driver: Chrome,
    wait: WebDriverWait,
    url: str,
    previous_name: str = "",
) -> Dict[str, str]:
    driver.get(url)

    try:
        esperar_detalle_negocio(driver, wait, previous_name=previous_name)
    except TimeoutException:
        log("Detalle incompleto, guardando datos parciales")

    human_delay(*DETAIL_PAUSE_SECONDS)

    try:
        nombre = extraer_nombre(driver) or ""
    except WebDriverException:
        nombre = ""

    try:
        direccion = extraer_direccion(driver) or ""
    except WebDriverException:
        direccion = ""

    try:
        telefono = extraer_telefono(driver) or ""
    except WebDriverException:
        telefono = ""

    try:
        web = extraer_web(driver) or ""
    except WebDriverException:
        web = ""

    try:
        rating = extraer_rating(driver) or ""
    except WebDriverException:
        rating = ""

    ciudad, region = extraer_ciudad_region(direccion)

    return {
        "nombre": limpiar_texto(nombre),
        "direccion": limpiar_texto(direccion),
        "ciudad": limpiar_texto(ciudad),
        "region": limpiar_texto(region),
        "telefono": limpiar_texto(telefono),
        "instagram": normalizar_instagram_url(web),
        "email": None,
        "web": limpiar_texto(web),
        "rating": limpiar_texto(rating),
        "google_maps_url": limpiar_texto(driver.current_url or url),
    }


def guardar_json(data: List[Dict[str, str]], output_file: Path) -> None:
    output_file.parent.mkdir(parents=True, exist_ok=True)
    with output_file.open("w", encoding="utf-8") as file:
        json.dump(data, file, ensure_ascii=False, indent=2)
    log(f"Archivo generado en: {output_file}")


def procesar_urls_negocios(
    driver: Chrome,
    wait: WebDriverWait,
    urls: List[str],
) -> List[Dict[str, str]]:
    resultados: List[Dict[str, str]] = []
    urls_vistas: Set[str] = set()
    previous_name = ""
    total_encontrados = 0
    total_guardados = 0
    descartados = 0

    for url in urls[:MAX_RESULTS]:
        if url in urls_vistas:
            continue

        urls_vistas.add(url)
        total_encontrados += 1
        log(f"Procesando negocio: {url}")

        try:
            data = extraer_datos_negocio(driver, wait, url, previous_name=previous_name)
        except WebDriverException as error:
            log(f"Error extrayendo negocio: {error}")
            data = {
                "nombre": "",
                "direccion": "",
                "ciudad": "",
                "region": "",
                "telefono": "",
                "instagram": "",
                "email": None,
                "web": "",
                "rating": "",
                "google_maps_url": limpiar_texto(url),
            }

        data["telefono"] = limpiar_telefono(data.get("telefono", ""))
        data["region"] = limpiar_texto(data.get("region", ""))
        data["ciudad"] = limpiar_ciudad(
            data.get("ciudad", ""),
            data.get("region", ""),
        )
        if not data["ciudad"]:
            data["ciudad"] = "Desconocido"
        if not data["region"]:
            data["region"] = "Desconocido"

        if not nombre_valido(data.get("nombre", "")):
            descartados += 1
            log("[SKIP] Nombre inválido")
            continue

        if not direccion_valida(data.get("direccion", "")):
            descartados += 1
            log("[SKIP] Dirección inválida")
            continue

        previous_name = data.get("nombre", "") or previous_name
        resultados.append(data)
        total_guardados += 1
        log(f"[OK] Negocio válido: {data.get('nombre', '')} - {data.get('ciudad', '')}")
        if data.get("ciudad") == "Desconocido" or data.get("region") == "Desconocido":
            log("[WARN] datos incompletos pero guardado")

    log(f"Total encontrados: {total_encontrados}")
    log(f"Total guardados: {total_guardados}")
    log(f"Total descartados: {descartados}")
    return resultados


def main() -> None:
    args = parse_args()
    region = limpiar_texto(args.region) or DEFAULT_REGION
    query = build_query(region)
    output_file = build_output_file(region)
    driver: Optional[Chrome] = None
    try:
        driver = iniciar_driver()
        wait = WebDriverWait(driver, WAIT_TIMEOUT)

        buscar_barberias(driver, wait, query=query)
        urls = recolectar_urls_negocios(driver, wait, max_results=MAX_RESULTS)
        log(f"Total URLs recolectadas: {len(urls)}")

        resultados = procesar_urls_negocios(driver, wait, urls)
        guardar_json(resultados, output_file=output_file)

        log(f"Total negocios procesados: {len(urls[:MAX_RESULTS])}")
        log(f"Total guardados: {len(resultados)}")
    finally:
        if driver is not None:
            driver.quit()


if __name__ == "__main__":
    main()
