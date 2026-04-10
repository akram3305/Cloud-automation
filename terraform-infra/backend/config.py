import os
from dotenv import load_dotenv

load_dotenv()

# ── App ───────────────────────────────────────────────────────
APP_NAME    = "AIonOS Self-Service Platform"
APP_VERSION = "1.0.0"
DEBUG       = os.getenv("DEBUG", "false").lower() == "true"

# ── Database ──────────────────────────────────────────────────
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./platform.db")

# ── JWT ───────────────────────────────────────────────────────
JWT_SECRET    = os.getenv("JWT_SECRET", "change-me-in-production-please")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_MINUTES = 60 * 8  # 8 hours

# ── AWS ───────────────────────────────────────────────────────
AWS_REGION         = os.getenv("AWS_REGION", "ap-south-1")
AWS_PROFILE        = os.getenv("AWS_PROFILE", None)          # optional named profile

# ── Terraform ────────────────────────────────────────────────
TERRAFORM_BINARY    = os.getenv("TERRAFORM_BINARY", "terraform")
TERRAFORM_WORKSPACE = os.getenv("TERRAFORM_WORKSPACE", "/home/claude/platform/terraform_workspaces")
MODULES_PATH        = os.getenv("MODULES_PATH", "/home/claude/platform/modules")

# ── Notifications ─────────────────────────────────────────────
SLACK_WEBHOOK_URL = os.getenv("SLACK_WEBHOOK_URL", "")       # empty = skip Slack
SES_FROM_EMAIL    = os.getenv("SES_FROM_EMAIL", "")          # empty = skip email

# ── CORS ──────────────────────────────────────────────────────
ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
]
