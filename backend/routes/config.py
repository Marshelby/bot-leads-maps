from fastapi import APIRouter, HTTPException, Query

from backend.services.config_service import get_ciudades, get_nichos, get_regiones


router = APIRouter(prefix="/config", tags=["config"])


@router.get("/regiones")
def get_regiones_endpoint() -> dict:
    return {"regiones": get_regiones()}


@router.get("/nichos")
def get_nichos_endpoint() -> dict:
    return {"nichos": get_nichos()}


@router.get("/ciudades")
def get_ciudades_endpoint(region: str = Query(..., min_length=1)) -> dict:
    region = region.strip()
    if not region:
        raise HTTPException(status_code=422, detail="La región es obligatoria.")

    return {"region": region, "ciudades": get_ciudades(region)}
