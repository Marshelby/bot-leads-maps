import logging

from fastapi import FastAPI

from backend.routes.config import router as config_router
from backend.routes.files import router as files_router
from backend.routes.processor import router as processor_router
from backend.routes.scraper import router as scraper_router


logging.basicConfig(level=logging.INFO)

app = FastAPI(title="BotLeadsMaps Backend")
app.include_router(config_router, prefix="/api")
app.include_router(files_router, prefix="/api")
app.include_router(processor_router, prefix="/api")
app.include_router(scraper_router, prefix="/api")
