import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.services.scraper_service import run_scraper


logger = logging.getLogger(__name__)
router = APIRouter(prefix="/scraper", tags=["scraper"])


class ScraperRunRequest(BaseModel):
    city: str
    niche: str


@router.post("/run")
def run_scraper_endpoint(payload: ScraperRunRequest) -> dict:
    city = payload.city.strip()
    niche = payload.niche.strip()
    if not city:
        raise HTTPException(status_code=422, detail="La ciudad es obligatoria.")
    if not niche:
        raise HTTPException(status_code=422, detail="El nicho es obligatorio.")

    logger.info("Solicitud de scraping recibida para niche=%s city=%s", niche, city)

    try:
        return run_scraper(city, niche)
    except RuntimeError as error:
        raise HTTPException(status_code=500, detail=str(error)) from error
