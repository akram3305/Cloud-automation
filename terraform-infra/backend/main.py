# -*- coding: utf-8 -*-
"""
main.py — AIonOS Platform
FastAPI application entry point
"""
from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import threading
import time
import boto3
from datetime import datetime

from core.config import settings
from database import engine, Base, SessionLocal
from models import User, VM, Request
from routers.auth import hash_password

# ── Import all routers ─────────────────────────────────────────────────────
from routers import auth
from routers import requests
from routers import vms
from routers import cost
from routers import s3
from routers import eks
from routers import infra
from routers import logs
from routers import vpc
from routers import iam
from routers import approvals
from routers import terraform
from routers import sync

# ──────────────────────────────────────────────────────────────────────────
# DATABASE SETUP
# ──────────────────────────────────────────────────────────────────────────

Base.metadata.create_all(bind=engine)

# ── Lightweight column migrations (idempotent — safe to run every startup) ─
from sqlalchemy import text as _sql_text

def _run_migrations():
    """Add new columns to existing tables without breaking anything."""
    migrations = [
        "ALTER TABLE vms ADD COLUMN environment  VARCHAR(32)  DEFAULT 'dev'",
        "ALTER TABLE vms ADD COLUMN project_tag  VARCHAR(128)",
        "ALTER TABLE vms ADD COLUMN owner_tag    VARCHAR(128)",
    ]
    with engine.connect() as conn:
        for stmt in migrations:
            try:
                conn.execute(_sql_text(stmt))
                conn.commit()
            except Exception:
                pass  # column already exists — ignore

_run_migrations()

# ──────────────────────────────────────────────────────────────────────────
# SEED DEFAULT USERS
# ──────────────────────────────────────────────────────────────────────────

def seed_users():
    """Create default users if none exist."""
    db = SessionLocal()
    try:
        if db.query(User).count() == 0:
            db.add_all([
                User(
                    username   = "admin",
                    email      = "admin@aionos.ai",
                    full_name  = "Admin",
                    role       = "admin",
                    hashed_pwd = hash_password("Admin@123"),
                    is_active  = True,
                ),
                User(
                    username   = "operator",
                    email      = "operator@aionos.ai",
                    full_name  = "Operator",
                    role       = "operator",
                    hashed_pwd = hash_password("Oper@123"),
                    is_active  = True,
                ),
                User(
                    username   = "viewer",
                    email      = "viewer@aionos.ai",
                    full_name  = "Viewer",
                    role       = "viewer",
                    hashed_pwd = hash_password("View@123"),
                    is_active  = True,
                ),
                User(
                    username   = "system",
                    email      = "system@internal.aionos.ai",
                    full_name  = "System User",
                    role       = "admin",
                    hashed_pwd = hash_password("system"),
                    is_active  = True,
                ),
            ])
            db.commit()
            print("✅ Default users created: admin / operator / viewer / system")
    except Exception as e:
        print(f"Seed error: {e}")
    finally:
        db.close()

seed_users()


# ──────────────────────────────────────────────────────────────────────────
# FASTAPI APP
# ──────────────────────────────────────────────────────────────────────────

app = FastAPI(
    title       = settings.APP_NAME,
    version     = settings.APP_VERSION,
    description = "AIonOS Infrastructure Automation Platform",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins     = settings.ALLOWED_ORIGINS,
    allow_credentials = True,
    allow_methods     = ["*"],
    allow_headers     = ["*"],
)


# ──────────────────────────────────────────────────────────────────────────
# REGISTER ROUTERS
# ──────────────────────────────────────────────────────────────────────────

app.include_router(auth.router)
app.include_router(requests.router)
app.include_router(vms.router)
app.include_router(cost.router)
app.include_router(s3.router)
app.include_router(eks.router)
app.include_router(infra.router)
app.include_router(logs.router)
app.include_router(vpc.router)
app.include_router(iam.router)
app.include_router(approvals.router)
app.include_router(terraform.router)
app.include_router(sync.router)


# ──────────────────────────────────────────────────────────────────────────
# HEALTH CHECK
# ──────────────────────────────────────────────────────────────────────────

@app.get("/health", tags=["health"])
def health():
    return {
        "status":  "ok",
        "app":     settings.APP_NAME,
        "version": settings.APP_VERSION,
        "env":     settings.PLATFORM_ENV,
    }


# ──────────────────────────────────────────────────────────────────────────
# AUTO SYNC LOOP — syncs AWS EC2 state to local DB
# ──────────────────────────────────────────────────────────────────────────

SYNC_REGIONS  = ["ap-south-1"]
SYNC_INTERVAL = 10  # seconds — faster sync for near-real-time updates


def _normalize_env(raw: str) -> str:
    """Normalize an AWS Environment tag value to dev/staging/prod."""
    v = (raw or "dev").lower().strip()
    if v in ("production", "prod"):     return "prod"
    if v in ("staging", "stage"):       return "staging"
    if v in ("dev", "development"):     return "dev"
    return "dev"


def auto_sync_loop():
    """
    Background thread — syncs ALL EC2 instance state from AWS to DB.
    Discovers instances created directly in AWS (not just platform-managed ones).
    """
    while True:
        try:
            db          = SessionLocal()
            system_user = db.query(User).filter(User.username == "system").first()
            system_id   = system_user.id if system_user else 1

            for region in SYNC_REGIONS:
                try:
                    ec2  = boto3.client("ec2", region_name=region)
                    # Sync ALL non-terminated instances (including AWS-console-created ones)
                    resp = ec2.describe_instances(
                        Filters=[
                            {"Name": "instance-state-name",
                             "Values": ["pending", "running", "stopping", "stopped"]},
                        ]
                    )

                    for reservation in resp["Reservations"]:
                        for inst in reservation["Instances"]:
                            iid   = inst["InstanceId"]
                            state = inst["State"]["Name"]
                            tags  = inst.get("Tags", [])

                            def _tag(key, default=""):
                                return next((t["Value"] for t in tags if t["Key"] == key), default)

                            name          = _tag("Name", iid)
                            environment   = _normalize_env(_tag("Environment", "dev"))
                            project_tag   = _tag("Project") or _tag("project") or None
                            owner_tag     = _tag("Owner") or _tag("ManagedBy") or _tag("CreatedBy") or None
                            public_ip     = inst.get("PublicIpAddress")
                            instance_type = inst.get("InstanceType")
                            ami           = inst.get("ImageId")

                            vm = db.query(VM).filter(VM.instance_id == iid).first()

                            if vm:
                                # Update existing VM
                                vm.state       = state
                                vm.public_ip   = public_ip
                                vm.environment = environment
                                if project_tag: vm.project_tag = project_tag
                                if owner_tag:   vm.owner_tag   = owner_tag
                                if state == "running":
                                    vm.start_time = vm.start_time or datetime.utcnow()
                                else:
                                    vm.start_time = None
                            else:
                                # Register new VM discovered directly in AWS
                                print(f"Sync: Discovered new VM {iid} ({name}) [{environment}]")
                                new_vm = VM(
                                    name          = name,
                                    instance_id   = iid,
                                    instance_type = instance_type,
                                    region        = region,
                                    state         = state,
                                    ami_id        = ami or "unknown",
                                    public_ip     = public_ip,
                                    owner_id      = system_id,
                                    owner_username= "aws-console",
                                    environment   = environment,
                                    project_tag   = project_tag,
                                    owner_tag     = owner_tag,
                                    start_time    = datetime.utcnow() if state == "running" else None,
                                )
                                db.add(new_vm)

                    db.commit()

                except Exception as e:
                    print(f"Sync error [{region}]: {e}")

        except Exception as e:
            print(f"Sync loop error: {e}")
        finally:
            try:
                db.close()
            except Exception:
                pass

        time.sleep(SYNC_INTERVAL)


threading.Thread(target=auto_sync_loop, daemon=True).start()
print("✅ Auto-sync loop started")


# ──────────────────────────────────────────────────────────────────────────
# SCHEDULER LOOP — auto start/stop VMs by schedule
# ──────────────────────────────────────────────────────────────────────────

def scheduler_loop():
    import datetime as _dt
    while True:
        try:
            db = SessionLocal()
            now = _dt.datetime.now().strftime("%H:%M")

            from sqlalchemy import or_
            vms = db.query(VM).filter(
                or_(
                    (VM.auto_start != None) & (VM.auto_start != ""),
                    (VM.auto_stop  != None) & (VM.auto_stop  != "")
                )
            ).all()

            for vm in vms:
                if not vm.instance_id:
                    continue
                try:
                    region = vm.region or "ap-south-1"
                    ec2    = boto3.client("ec2", region_name=region)

                    start_t = str(vm.auto_start or "").strip()[:5] or None
                    stop_t  = str(vm.auto_stop  or "").strip()[:5] or None

                    if start_t and start_t == now and vm.state == "stopped":
                        print(f"Scheduler: STARTING {vm.name} at {now}")
                        ec2.start_instances(InstanceIds=[vm.instance_id])
                        vm.state      = "pending"
                        vm.start_time = _dt.datetime.utcnow()

                    if stop_t and stop_t == now and vm.state == "running":
                        print(f"Scheduler: STOPPING {vm.name} at {now}")
                        ec2.stop_instances(InstanceIds=[vm.instance_id])
                        vm.state      = "stopping"
                        vm.start_time = None

                except Exception as e:
                    if "InvalidInstanceID" not in str(e) and "not found" not in str(e).lower():
                        print(f"Scheduler error {vm.name}: {e}")

            db.commit()
            db.close()
        except Exception as e:
            print(f"Scheduler loop error: {e}")
        time.sleep(10)


threading.Thread(target=scheduler_loop, daemon=True).start()
print("✅ Scheduler loop started")