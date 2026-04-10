# -*- coding: utf-8 -*-
"""
core/config.py — Centralized configuration
All settings loaded from environment variables / .env file
No hardcoded paths, credentials, or secrets
"""
from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):

    # ── Application ────────────────────────────────────────────────
    APP_NAME:     str  = "AIonOS Platform"
    APP_VERSION:  str  = "1.0.0"
    DEBUG:        bool = False
    PLATFORM_ENV: str  = "development"   # development | staging | production

    # ── Security / JWT ─────────────────────────────────────────────
    SECRET_KEY:                  str = "change-me-in-production"
    ALGORITHM:                   str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480

    # ── Database ───────────────────────────────────────────────────
    DATABASE_URL: str = "sqlite:///./platform.db"

    # ── AWS ────────────────────────────────────────────────────────
    AWS_ACCESS_KEY_ID:     str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_DEFAULT_REGION:    str = "ap-south-1"

    # ── Terraform ──────────────────────────────────────────────────
    TF_STATE_BUCKET:  str = "aionos-terraform-state-3305"
    TF_STATE_REGION:  str = "ap-south-1"
    TF_DYNAMO_TABLE:  str = "terraform-lock"
    TF_PROJECT_ROOT:  str = ""          # set in .env — no default path
    TERRAFORM_BIN:    str = "terraform"
    KEY_SAVE_PATH:    str = "./keys"    # where .pem files are saved

    # ── CORS ───────────────────────────────────────────────────────
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
    ]

    class Config:
        env_file        = ".env"
        case_sensitive  = True


settings = Settings()

# ── Convenience exports used across routers/services ──────────────────────
APP_NAME    = settings.APP_NAME
APP_VERSION = settings.APP_VERSION
DEBUG       = settings.DEBUG

JWT_SECRET          = settings.SECRET_KEY
JWT_ALGORITHM       = settings.ALGORITHM
JWT_EXPIRE_MINUTES  = settings.ACCESS_TOKEN_EXPIRE_MINUTES

DATABASE_URL = settings.DATABASE_URL

AWS_ACCESS_KEY    = settings.AWS_ACCESS_KEY_ID
AWS_SECRET_KEY    = settings.AWS_SECRET_ACCESS_KEY
AWS_REGION        = settings.AWS_DEFAULT_REGION

TF_STATE_BUCKET   = settings.TF_STATE_BUCKET
TF_STATE_REGION   = settings.TF_STATE_REGION
TF_DYNAMO_TABLE   = settings.TF_DYNAMO_TABLE
TF_PROJECT_ROOT   = settings.TF_PROJECT_ROOT
TERRAFORM_BIN     = settings.TERRAFORM_BIN
KEY_SAVE_PATH     = settings.KEY_SAVE_PATH

ALLOWED_ORIGINS   = settings.ALLOWED_ORIGINS