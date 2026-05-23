from fastapi import FastAPI

from app.api.line_webhook import router as line_router

app = FastAPI(
    title="Coinly LINE Chatbot API",
    description="LINE chatbot backend for Coinly AI Finance Tracker",
    version="1.0.0"
)

@app.get("/")
def root():
    return {
        "message": "Coinly LINE Chatbot API is running.",
        "docs": "/docs"
    }

@app.get("/health")
def health_check():
    return {"status": "ok"}

app.include_router(
    line_router,
    prefix="/api/v1/line",
    tags=["Line Webhook"]
)