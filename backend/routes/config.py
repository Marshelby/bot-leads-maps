from fastapi import APIRouter, HTTPException, Query

from backend.services.config_service import (
    DEFAULT_COUNTRY,
    get_ciudades,
    get_countries,
    get_nichos,
    get_regiones,
)


router = APIRouter(prefix="/config", tags=["config"])


@router.get("/countries")
def get_countries_endpoint() -> dict:
    return {"countries": get_countries()}


@router.get("/regiones")
def get_regiones_endpoint(country: str = Query(DEFAULT_COUNTRY, min_length=1)) -> dict:
    country = country.strip()
    if not country:
        raise HTTPException(status_code=422, detail="El país es obligatorio.")

    return {"country": country, "regiones": get_regiones(country=country)}


@router.get("/nichos")
def get_nichos_endpoint() -> dict:
    return {"nichos": get_nichos()}


@router.get("/ciudades")
def get_ciudades_endpoint(
    region: str = Query(..., min_length=1),
    country: str = Query(DEFAULT_COUNTRY, min_length=1),
) -> dict:
    country = country.strip()
    region = region.strip()
    if not country:
        raise HTTPException(status_code=422, detail="El país es obligatorio.")
    if not region:
        raise HTTPException(status_code=422, detail="La región es obligatoria.")

    return {"country": country, "region": region, "ciudades": get_ciudades(region, country=country)}
