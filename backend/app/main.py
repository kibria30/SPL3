from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import admin, auth, datasets, experiments, models
from app.core.config import settings

app = FastAPI(title="Visual TS Forecasting Library API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(datasets.router)
app.include_router(experiments.router)
app.include_router(models.router)
app.include_router(admin.router)


@app.get("/health")
def health():
    return {"status": "ok"}
