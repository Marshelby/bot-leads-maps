from fastapi import APIRouter

from backend.services.scraper_service import DATA_DIR


router = APIRouter(tags=["files"])


@router.get("/files")
def list_files_endpoint() -> dict:
    raw: list[str] = []
    processed: list[str] = []

    for path in sorted(DATA_DIR.glob("*.json")):
        relative_path = f"data/{path.name}"
        if path.name.endswith("_full.json"):
            processed.append(relative_path)
        else:
            raw.append(relative_path)

    return {
        "raw": raw,
        "processed": processed,
    }
