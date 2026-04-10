# -*- coding: utf-8 -*-
"""
Move all hardcoded credentials to .env file
Run from: D:\AWS_Terraform_automation\terraform-infra\backend\
"""
import os, re
from pathlib import Path

backend = Path(r"D:\AWS_Terraform_automation\terraform-infra\backend")

# ─── Step 1: Read existing .env ──────────────────────────────
env_file = backend / ".env"
existing_env = ""
if env_file.exists():
    with open(env_file, "r", encoding="utf-8") as f:
        existing_env = f.read()

# ─── Step 2: Extract credentials from files ──────────────────
import boto3
session = boto3.session.Session()
creds   = session.get_credentials().get_frozen_credentials()

# Read SECRET_KEY from config.py or auth.py
secret_key = "change-me-to-random-32-char-string"
for fname in ["config.py", "routers/auth.py", "auth.py"]:
    fpath = backend / fname
    if fpath.exists():
        content = fpath.read_text(encoding="utf-8", errors="ignore")
        match = re.search(r'SECRET_KEY\s*=\s*["\']([^"\']+)["\']', content)
        if match:
            secret_key = match.group(1)
            print(f"Found SECRET_KEY in {fname}")
            break

# ─── Step 3: Write .env file ─────────────────────────────────
env_content = f"""# AIonOS Platform - Environment Variables
# Generated automatically - DO NOT COMMIT TO GIT

# ── Application ───────────────────────────────────────────────
APP_NAME=AIonOS Platform
APP_VERSION=1.0.0
DEBUG=false
PLATFORM_ENV=development

# ── Security ──────────────────────────────────────────────────
SECRET_KEY={secret_key}
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=480

# ── Database ──────────────────────────────────────────────────
DATABASE_URL=sqlite:///./platform.db

# ── AWS Credentials ───────────────────────────────────────────
AWS_ACCESS_KEY_ID={creds.access_key}
AWS_SECRET_ACCESS_KEY={creds.secret_key}
AWS_DEFAULT_REGION=ap-south-1

# ── Terraform ─────────────────────────────────────────────────
TF_STATE_BUCKET=aionos-terraform-state-3305
TF_DYNAMO_TABLE=terraform-lock
TF_PROJECT_ROOT=D:\\AWS_Terraform_automation\\terraform-infra
TF_WORKSPACES_DIR=D:\\AWS_Terraform_automation\\terraform-infra\\backend\\terraform\\workspaces

# ── CORS ──────────────────────────────────────────────────────
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
"""

with open(env_file, "w", encoding="utf-8") as f:
    f.write(env_content)
print(f"OK .env file written")

# ─── Step 4: Update terraform_service.py ─────────────────────
tf_service = backend / "services" / "terraform_service.py"
if tf_service.exists():
    content = tf_service.read_text(encoding="utf-8")

    # Replace hardcoded credentials with env vars
    old_creds = f"""import boto3 as _boto3
_session = _boto3.session.Session()
_creds   = _session.get_credentials().get_frozen_credentials()
AWS_ACCESS_KEY = _creds.access_key
AWS_SECRET_KEY = _creds.secret_key"""

    new_creds = """import os as _os
from dotenv import load_dotenv as _load_dotenv
_load_dotenv()
AWS_ACCESS_KEY = _os.getenv("AWS_ACCESS_KEY_ID", "")
AWS_SECRET_KEY = _os.getenv("AWS_SECRET_ACCESS_KEY", "")
STATE_BUCKET   = _os.getenv("TF_STATE_BUCKET", "aionos-terraform-state-3305")
DYNAMO_TABLE   = _os.getenv("TF_DYNAMO_TABLE", "terraform-lock")"""

    if "_creds.access_key" in content:
        content = content.replace(old_creds, new_creds)
        print("OK terraform_service.py - credentials replaced with env vars")
    else:
        # Already using env or different pattern - just add dotenv load
        if "load_dotenv" not in content:
            content = "import os as _os\nfrom dotenv import load_dotenv as _load_dotenv\n_load_dotenv()\n" + content
            print("OK terraform_service.py - dotenv load added")

    tf_service.write_text(content, encoding="utf-8")

# ─── Step 5: Update main.py ───────────────────────────────────
main_py = backend / "main.py"
if main_py.exists():
    content = main_py.read_text(encoding="utf-8")
    if "load_dotenv" not in content:
        content = "from dotenv import load_dotenv\nload_dotenv()\n\n" + content
        main_py.write_text(content, encoding="utf-8")
        print("OK main.py - dotenv load added")

# ─── Step 6: Update .gitignore ───────────────────────────────
gitignore = backend.parent / ".gitignore"
gi_content = ""
if gitignore.exists():
    gi_content = gitignore.read_text(encoding="utf-8")

if ".env" not in gi_content:
    with open(gitignore, "a", encoding="utf-8") as f:
        f.write("\n# Secrets\n.env\n*.pem\n*.key\nkeys/\n")
    print("OK .gitignore - .env added")

# ─── Step 7: Create .env.example ─────────────────────────────
env_example = backend / ".env.example"
example_content = """# AIonOS Platform - Environment Variables Template
# Copy this file to .env and fill in your values
# DO NOT put real credentials here

APP_NAME=AIonOS Platform
APP_VERSION=1.0.0
DEBUG=false
PLATFORM_ENV=development

SECRET_KEY=generate-with-openssl-rand-hex-32
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=480

DATABASE_URL=sqlite:///./platform.db

AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_DEFAULT_REGION=ap-south-1

TF_STATE_BUCKET=your-terraform-state-bucket
TF_DYNAMO_TABLE=your-dynamodb-lock-table
TF_PROJECT_ROOT=D:\\AWS_Terraform_automation\\terraform-infra
TF_WORKSPACES_DIR=D:\\AWS_Terraform_automation\\terraform-infra\\backend\\terraform\\workspaces

ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
"""
env_example.write_text(example_content, encoding="utf-8")
print("OK .env.example created")

print("\n" + "="*50)
print("DONE - Credentials moved to .env")
print("="*50)
print("\nIMPORTANT:")
print("  1. .env file bana diya - credentials wahan hain")
print("  2. .env.example bana diya - template hai")
print("  3. .gitignore mein .env add kar diya")
print("  4. Kabhi bhi .env file GitHub pe push mat karo")
print("\n  python-dotenv install karo:")
print("  pip install python-dotenv")
