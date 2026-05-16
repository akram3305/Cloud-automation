# -*- coding: utf-8 -*-
"""
main.py — AIonOS Platform
FastAPI application entry point
"""
import sys
if sys.stdout.encoding and sys.stdout.encoding.lower() not in ("utf-8", "utf8"):
    sys.stdout.reconfigure(encoding="utf-8")

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
from models import User, VM, Request, GcpSshKey, AwsSshKey, BudgetConfig, BudgetAlertLog, VMUtilization, VMBudget, VMBudgetAlertLog, CloudCredential, GcpCostSnapshot
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
from routers import alerts
from routers import azure_vms
from routers import azure_storage
from routers import gcp_compute
from routers import gcp_kubernetes
from routers import monitoring
from routers import credentials
from routers import cloud_projects
from routers import gcp_projects
from routers import gcp_billing
from routers import blueprints
from routers import webssh
from routers import search
from routers import comments
from routers import k8s_manager
from services import gcp_client

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
        # cloud_credentials table is created by SQLAlchemy automatically via Base.metadata.create_all
        # No manual ALTER needed for new tables
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
app.include_router(alerts.router)
app.include_router(azure_vms.router)
app.include_router(azure_storage.router)
app.include_router(gcp_compute.router)
app.include_router(gcp_kubernetes.router)
app.include_router(monitoring.router)
app.include_router(credentials.router)
app.include_router(cloud_projects.router)
app.include_router(gcp_projects.router)
app.include_router(gcp_billing.router)
app.include_router(blueprints.router)
app.include_router(search.router)
app.include_router(comments.router)
app.include_router(k8s_manager.router)
app.include_router(webssh.router)


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

                    # ── Step 1: fetch all active (non-terminated) instances ──
                    active_resp = ec2.describe_instances(
                        Filters=[{"Name": "instance-state-name",
                                  "Values": ["pending", "running", "stopping", "stopped"]}]
                    )

                    active_ids: set = set()

                    for reservation in active_resp["Reservations"]:
                        for inst in reservation["Instances"]:
                            iid   = inst["InstanceId"]
                            state = inst["State"]["Name"]
                            active_ids.add(iid)
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

                    # ── Step 2: remove DB entries for instances deleted in AWS ──
                    # Any DB VM in this region whose instance_id is no longer active → delete it
                    db_vms = db.query(VM).filter(VM.region == region).all()
                    for db_vm in db_vms:
                        if db_vm.instance_id and db_vm.instance_id not in active_ids:
                            print(f"Sync: Removing {db_vm.instance_id} ({db_vm.name}) — deleted/terminated in AWS")
                            db.delete(db_vm)

                    # ── Step 3: also catch instances currently shutting-down/terminated ──
                    term_resp = ec2.describe_instances(
                        Filters=[{"Name": "instance-state-name",
                                  "Values": ["terminated", "shutting-down"]}]
                    )
                    for reservation in term_resp["Reservations"]:
                        for inst in reservation["Instances"]:
                            vm = db.query(VM).filter(VM.instance_id == inst["InstanceId"]).first()
                            if vm:
                                print(f"Sync: Removing terminated instance {inst['InstanceId']} ({vm.name})")
                                db.delete(vm)

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
    from models.alert import Alert

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
                        try:
                            ec2.start_instances(InstanceIds=[vm.instance_id])
                            vm.state      = "pending"
                            vm.start_time = _dt.datetime.utcnow()
                            _sched_notify(db, "start", vm.name, "aws", vm.region, start_t, owner=vm.owner_username)
                        except Exception as start_err:
                            msg = f"Auto-start FAILED for '{vm.name}' (id={vm.instance_id}) at {now}: {start_err}"
                            print(f"Scheduler alert: {msg}")
                            db.add(Alert(
                                vm_id      = vm.id,
                                vm_name    = vm.name,
                                alert_type = "scheduler_failure",
                                message    = msg,
                            ))
                            _sched_notify_failed(db, "start", vm.name, "aws", vm.region, start_t, str(start_err))

                    if stop_t and stop_t == now and vm.state == "running":
                        print(f"Scheduler: STOPPING {vm.name} at {now}")
                        try:
                            ec2.stop_instances(InstanceIds=[vm.instance_id])
                            vm.state      = "stopping"
                            vm.start_time = None
                            _sched_notify(db, "stop", vm.name, "aws", vm.region, stop_t, owner=vm.owner_username)
                        except Exception as stop_err:
                            msg = f"Auto-stop FAILED for '{vm.name}' (id={vm.instance_id}) at {now}: {stop_err}"
                            print(f"Scheduler alert: {msg}")
                            db.add(Alert(
                                vm_id      = vm.id,
                                vm_name    = vm.name,
                                alert_type = "scheduler_failure",
                                message    = msg,
                            ))
                            _sched_notify_failed(db, "stop", vm.name, "aws", vm.region, stop_t, str(stop_err))

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


# ──────────────────────────────────────────────────────────────────────────
# AZURE SCHEDULER LOOP — auto start/stop Azure VMs via tags
# ──────────────────────────────────────────────────────────────────────────

def azure_scheduler_loop():
    """
    Check every 60 s for Azure VMs whose auto_start / auto_stop tags
    match the current HH:MM and start or deallocate them accordingly.
    Tags are set via POST /azure/vms/{rg}/{vm}/schedule.
    """
    from services.azure_client import get_compute_client, VALID_SUBSCRIPTIONS
    import datetime as _dt

    while True:
        try:
            now = _dt.datetime.now().strftime("%H:%M")
            for sub in ("nonprod", "prod"):
                try:
                    compute = get_compute_client(sub)
                    for vm in list(compute.virtual_machines.list_all()):
                        tags = vm.tags or {}
                        auto_start = (tags.get("auto_start") or "").strip()[:5]
                        auto_stop  = (tags.get("auto_stop")  or "").strip()[:5]
                        if not auto_start and not auto_stop:
                            continue

                        rg = vm.id.split("/resourceGroups/")[1].split("/")[0]
                        try:
                            iv = compute.virtual_machines.get(rg, vm.name, expand="instanceView")
                            pstate = "unknown"
                            for s in (iv.instance_view.statuses or []):
                                if s.code and s.code.startswith("PowerState/"):
                                    pstate = s.code.split("/")[1]; break
                        except Exception:
                            continue

                        if auto_start == now and pstate == "deallocated":
                            try:
                                compute.virtual_machines.begin_start(rg, vm.name)
                                print(f"☁ Azure Scheduler: STARTING {vm.name} [{sub}] at {now}")
                                _sched_notify_bg("start", vm.name, "azure", rg, auto_start)
                            except Exception as _ae:
                                print(f"Azure scheduler start error [{vm.name}]: {_ae}")
                                _sched_notify_failed_bg("start", vm.name, "azure", rg, auto_start, str(_ae))

                        if auto_stop == now and pstate == "running":
                            try:
                                compute.virtual_machines.begin_deallocate(rg, vm.name)
                                print(f"☁ Azure Scheduler: STOPPING {vm.name} [{sub}] at {now}")
                                _sched_notify_bg("stop", vm.name, "azure", rg, auto_stop)
                            except Exception as _ae:
                                print(f"Azure scheduler stop error [{vm.name}]: {_ae}")
                                _sched_notify_failed_bg("stop", vm.name, "azure", rg, auto_stop, str(_ae))

                except Exception as e:
                    print(f"Azure scheduler error [{sub}]: {e}")
        except Exception as e:
            print(f"Azure scheduler loop error: {e}")

        time.sleep(60)   # check every minute


threading.Thread(target=azure_scheduler_loop, daemon=True).start()
print("✅ Azure scheduler loop started")


def gcp_scheduler_loop():
    import datetime as _dt

    while True:
        try:
            if not gcp_client.CONFIGURED:
                time.sleep(60)
                continue

            now = _dt.datetime.now().strftime("%H:%M")
            instances = gcp_client.list_instances(zone="-")
            for inst in instances:
                labels = inst.get("labels", {}) or {}
                auto_start = str(labels.get("auto_start", "")).strip()[:5].replace("-", ":")
                auto_stop = str(labels.get("auto_stop", "")).strip()[:5].replace("-", ":")
                if not auto_start and not auto_stop:
                    continue

                name = inst.get("name")
                zone = inst.get("zone")
                status = inst.get("status", "")
                try:
                    if auto_start == now and status in {"STOPPED", "TERMINATED", "SUSPENDED"}:
                        try:
                            gcp_client.start_instance(name=name, zone=zone)
                            print(f"☁ GCP Scheduler: STARTING {name} [{zone}] at {now}")
                            _sched_notify_bg("start", name, "gcp", zone, auto_start)
                        except Exception as _ge:
                            print(f"GCP scheduler start error [{name}]: {_ge}")
                            _sched_notify_failed_bg("start", name, "gcp", zone, auto_start, str(_ge))

                    if auto_stop == now and status == "RUNNING":
                        try:
                            gcp_client.stop_instance(name=name, zone=zone)
                            print(f"☁ GCP Scheduler: STOPPING {name} [{zone}] at {now}")
                            _sched_notify_bg("stop", name, "gcp", zone, auto_stop)
                        except Exception as _ge:
                            print(f"GCP scheduler stop error [{name}]: {_ge}")
                            _sched_notify_failed_bg("stop", name, "gcp", zone, auto_stop, str(_ge))
                except Exception as exc:
                    print(f"GCP scheduler error [{name}/{zone}]: {exc}")
        except Exception as exc:
            print(f"GCP scheduler loop error: {exc}")

        time.sleep(60)


threading.Thread(target=gcp_scheduler_loop, daemon=True).start()
print("✅ GCP scheduler loop started")


# ──────────────────────────────────────────────────────────────────────────
# MONITORING LOOP — VM utilization checks (every 30 min) + budget checks (every 60 min)
# ──────────────────────────────────────────────────────────────────────────

UTILIZATION_INTERVAL = 5 * 60    # 5 minutes
BUDGET_INTERVAL      = 15 * 60   # 15 minutes


def utilization_monitor_loop():
    from services.monitoring_loop import run_utilization_check
    time.sleep(30)  # brief startup delay — let the app fully boot first
    while True:
        try:
            run_utilization_check()
        except Exception as e:
            print(f"Utilization monitor error: {e}")
        time.sleep(UTILIZATION_INTERVAL)


def budget_monitor_loop():
    from services.monitoring_loop import run_budget_check
    time.sleep(60)  # start after utilization loop
    while True:
        try:
            run_budget_check()
        except Exception as e:
            print(f"Budget monitor error: {e}")
        time.sleep(BUDGET_INTERVAL)


threading.Thread(target=utilization_monitor_loop, daemon=True).start()
threading.Thread(target=budget_monitor_loop,      daemon=True).start()
print("✅ Monitoring loops started (utilization every 30 min, budget every 60 min)")


# ── Scheduler notification helpers ────────────────────────────────────────────

def _sched_notify(db, action, vm_name, cloud, region, schedule_time, owner=None):
    """Called inline in AWS scheduler loop (already has a db session)."""
    try:
        from services.notification_service import notify_schedule_triggered
        notify_schedule_triggered(db, action=action, vm_name=vm_name, cloud=cloud,
                                  region=region or "", schedule_time=schedule_time)
    except Exception as e:
        print(f"[Notify] schedule triggered error: {e}")


def _sched_notify_failed(db, action, vm_name, cloud, region, schedule_time, error):
    """Called inline in AWS scheduler loop (already has a db session)."""
    try:
        from services.notification_service import notify_schedule_failed
        notify_schedule_failed(db, action=action, vm_name=vm_name, cloud=cloud,
                               region=region or "", schedule_time=schedule_time, error=error)
    except Exception as e:
        print(f"[Notify] schedule failed error: {e}")


def _sched_notify_bg(action, vm_name, cloud, region, schedule_time):
    """Called from Azure/GCP loops — creates its own DB session."""
    try:
        from services.notification_service import notify_schedule_triggered
        _db = SessionLocal()
        notify_schedule_triggered(_db, action=action, vm_name=vm_name, cloud=cloud,
                                  region=region or "", schedule_time=schedule_time)
        _db.close()
    except Exception as e:
        print(f"[Notify] schedule triggered error: {e}")


def _sched_notify_failed_bg(action, vm_name, cloud, region, schedule_time, error):
    """Called from Azure/GCP loops — creates its own DB session."""
    try:
        from services.notification_service import notify_schedule_failed
        _db = SessionLocal()
        notify_schedule_failed(_db, action=action, vm_name=vm_name, cloud=cloud,
                               region=region or "", schedule_time=schedule_time, error=error)
        _db.close()
    except Exception as e:
        print(f"[Notify] schedule failed error: {e}")
