import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.services.config_service import DEFAULT_COUNTRY
from backend.services.scraper_service import run_region_scraper, run_scraper


logger = logging.getLogger(__name__)
router = APIRouter(prefix="/scraper", tags=["scraper"])


class ScraperRunRequest(BaseModel):
    country: str = DEFAULT_COUNTRY
    mode: str = "city"
    region: str = ""
    city: str = ""
    niche: str


@router.post("/run")
def run_scraper_endpoint(payload: ScraperRunRequest) -> dict:
    country = payload.country.strip() or DEFAULT_COUNTRY
    mode = payload.mode.strip().lower() or "city"
    region = payload.region.strip()
    city = payload.city.strip()
    niche = payload.niche.strip()

    if not niche:
        raise HTTPException(status_code=422, detail="El nicho es obligatorio.")

    if mode not in {"city", "region"}:
        raise HTTPException(status_code=422, detail="El modo debe ser 'city' o 'region'.")

    logger.info(
        "Solicitud de scraping recibida country=%s mode=%s region=%s city=%s niche=%s",
        country,
        mode,
        region,
        city,
        niche,
    )

    try:
        if mode == "city":
            if not city:
                raise HTTPException(status_code=422, detail="La ciudad es obligatoria en modo ciudad.")
            return run_scraper(city=city, niche=niche, country=country)

        if not region:
            raise HTTPException(status_code=422, detail="La región es obligatoria en modo región.")
        return run_region_scraper(region=region, niche=niche, country=country)
    except HTTPException:
        raise
    except RuntimeError as error:
        raise HTTPException(status_code=500, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
