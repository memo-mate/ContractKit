from fastapi import APIRouter

from api.routers import review

api_router = APIRouter()
api_router.include_router(review.router)
