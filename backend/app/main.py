from pathlib import Path

from fastapi import FastAPI, Response
from fastapi.staticfiles import StaticFiles

from app.api.line_webhook import router as line_router
from app.api.liff import router as liff_router

APP_DIR = Path(__file__).resolve().parent

app = FastAPI(
    title="Coinly LINE Chatbot API",
    description="LINE chatbot backend for Coinly AI Finance Tracker",
    version="1.1.0"
)

@app.get("/")
def root():
    return {
        "message": "Coinly LINE Chatbot API is running.",
        "docs": "/docs",
        "liff": "/liff/"
    }

app.include_router(
    line_router,
    prefix="/api/v1/line",
    tags=["LINE Webhook"],
)

app.include_router(
    liff_router,
    prefix="/api/v1/liff",
    tags=["LINE LIFF"]
)

app.mount(
    "/liff",
    StaticFiles(
        directory=APP_DIR / "static" / "liff",
        html=True,
    ),
    name='liff',
)

@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.head("/health")
def health_check_head():
    return Response(status_code=200)