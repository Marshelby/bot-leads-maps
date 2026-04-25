import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.services.processor_service import process_region


logger = logging.getLogger(__name__)
router = APIRouter(prefix="/processor", tags=["processor"])


class ProcessorRunRequest(BaseModel):
    region: str


@router.post("/run")
def run_processor_endpoint(payload: ProcessorRunRequest) -> dict:
    region = payload.region.strip()
    if not region:
        raise HTTPException(status_code=422, detail="La región es obligatoria.")

    logger.info("Solicitud de procesamiento recibida para region=%s", region)

    try:
        return process_region(region)
    except RuntimeError as error:
        raise HTTPException(status_code=500, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
