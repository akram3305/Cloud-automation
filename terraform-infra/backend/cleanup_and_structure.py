# -*- coding: utf-8 -*-
"""
AIonOS Platform - Cleanup & Production Structure Script
Run from: D:\AWS_Terraform_automation\terraform-infra\backend\
"""
import os, shutil
from pathlib import Path

backend = Path(r"D:\AWS_Terraform_automation\terraform-infra\backend")
frontend = Path(r"D:\AWS_Terraform_automation\terraform-infra\frontend")

# ─── Files to DELETE from backend root ────────────────────────
delete_patterns = [
    "fix_", "add_", "debug", "check_", "show_", "reg_",
    "update_", "migrate", "test_", "read_all", "read_all_modules",
    "ec2_control.py", "check_all.py", "check_status.py",
]

deleted = []
kept    = []

print("\n" + "="*60)
print("AIonOS Platform - Cleanup Report")
print("="*60)

print("\n[1] DELETING temp/fix/debug files from backend root...")
for f in sorted(backend.glob("*.py")):
    should_delete = any(f.name.startswith(p) for p in delete_patterns)
    if should_delete:
        f.unlink()
        deleted.append(f.name)
        print(f"  DELETED  {f.name}")
    else:
        kept.append(f.name)

print(f"\n  Deleted: {len(deleted)} files")
print(f"  Kept:    {len(kept)} files")

# ─── Create proper folder structure ───────────────────────────
print("\n[2] Creating production folder structure...")

folders = [
    backend / "routers",
    backend / "services",
    backend / "models",
    backend / "schemas",
    backend / "core",
    backend / "tests",
    backend / "scripts",
    backend / "logs",
]

for folder in folders:
    folder.mkdir(exist_ok=True)
    init = folder / "__init__.py"
    if not init.exists() and folder.name not in ["tests", "scripts", "logs"]:
        init.write_text("")
    print(f"  OK  {folder.name}/")

# ─── Create .gitignore ────────────────────────────────────────
print("\n[3] Creating .gitignore...")
gitignore = backend.parent / ".gitignore"
gitignore.write_text("""# Python
__pycache__/
*.pyc
*.pyo
*.pyd
.Python
*.egg-info/
dist/
build/
venv/
env/
.venv/

# Environment
.env
.env.local
.env.*.local

# Database
*.db
*.sqlite
*.sqlite3

# Terraform
.terraform/
*.tfstate
*.tfstate.backup
*.tfplan
tfplan
.terraform.lock.hcl

# AWS Credentials
*.pem
*.key
keys/

# Logs
logs/
*.log

# Node
node_modules/
dist/
.next/

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Temp files
fix_*.py
add_*.py
debug*.py
check_*.py
show_*.py
""")
print("  OK  .gitignore")

# ─── Create requirements.txt ──────────────────────────────────
print("\n[4] Creating requirements.txt...")
reqs = backend / "requirements.txt"
reqs.write_text("""fastapi==0.104.1
uvicorn[standard]==0.24.0
sqlalchemy==2.0.23
pydantic==2.5.0
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
python-dotenv==1.0.0
boto3==1.34.0
botocore==1.34.0
python-multipart==0.0.6
httpx==0.25.2
""")
print("  OK  requirements.txt")

# ─── Create .env.example ──────────────────────────────────────
print("\n[5] Creating .env.example...")
env_example = backend / ".env.example"
env_example.write_text("""# AIonOS Platform - Environment Variables
# Copy this to .env and fill in values

# JWT Secret (generate with: openssl rand -hex 32)
SECRET_KEY=your-secret-key-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=480

# Database
DATABASE_URL=sqlite:///./platform.db

# AWS
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_DEFAULT_REGION=ap-south-1

# Terraform State
TF_STATE_BUCKET=aionos-terraform-state-3305
TF_DYNAMO_TABLE=terraform-lock

# Platform
PLATFORM_ENV=development
DEBUG=true
""")
print("  OK  .env.example")

# ─── Final summary ────────────────────────────────────────────
print("\n" + "="*60)
print("CLEANUP COMPLETE")
print("="*60)
print(f"\nDeleted {len(deleted)} temp files")
print("\nKept files:")
for f in sorted(kept):
    print(f"  {f}")

print("\nNew structure created:")
print("  routers/    - API route handlers")
print("  services/   - Business logic")
print("  models/     - Database models")
print("  schemas/    - Pydantic schemas")
print("  core/       - Config, security, utils")
print("  tests/      - Test files")
print("  scripts/    - Utility scripts")
print("  logs/       - Log files")
