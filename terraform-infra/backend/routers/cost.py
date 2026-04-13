from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import Optional
import boto3
from datetime import datetime, timedelta

from database import get_db
from models import User, VM
from routers.auth import get_current_user

router = APIRouter(prefix="/cost", tags=["cost"])


def get_ce_client():
    return boto3.client("ce", region_name="us-east-1")


# 🔥 Real-time cost calculation
def calculate_realtime_cost(vms):
    pricing = {
        "t3.micro": 0.0104,
        "t3.small": 0.0208,
        "t3.medium": 0.0416,
        "t3.large": 0.0832,
        "m5.large": 0.096,
    }

    total = 0

    for vm in vms:
        if vm.state == "running" and vm.start_time:
            price = pricing.get(vm.instance_type, 0.0104)
            hours = (datetime.utcnow() - vm.start_time).total_seconds() / 3600
            total += hours * price

    return round(total, 2)


@router.get("/overview")
def get_cost_overview(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    try:
        ce = get_ce_client()
        today = datetime.today()

        start = today.replace(day=1).strftime("%Y-%m-%d")
        end = today.strftime("%Y-%m-%d")

        resp = ce.get_cost_and_usage(
            TimePeriod={"Start": start, "End": end},
            Granularity="MONTHLY",
            Metrics=["UnblendedCost"],
        )

        mtd = sum(float(r["Total"]["UnblendedCost"]["Amount"]) for r in resp["ResultsByTime"])

        # Forecast
        forecast = 0
        try:
            fstart = today.strftime("%Y-%m-%d")
            month_end = (today.replace(day=1) + timedelta(days=32)).replace(day=1) - timedelta(days=1)
            fend = month_end.strftime("%Y-%m-%d")

            if fstart < fend:
                fr = ce.get_cost_forecast(
                    TimePeriod={"Start": fstart, "End": fend},
                    Metric="UNBLENDED_COST",
                    Granularity="MONTHLY",
                )
                forecast = float(fr["Total"]["Amount"])
        except Exception:
            pass

        vms = db.query(VM).all()
        running = sum(1 for v in vms if v.state == "running")
        stopped = sum(1 for v in vms if v.state == "stopped")

        realtime_cost = calculate_realtime_cost(vms)

        return {
            "mtd_total": round(mtd, 2),
            "real_time_cost": realtime_cost,
            "forecast": round(mtd + forecast, 2),
            "running_vms": running,
            "stopped_vms": stopped,
            "currency": "USD",
            "source": "hybrid",
        }

    except Exception as e:
        print("Cost error:", e)

        vms = db.query(VM).all()
        realtime_cost = calculate_realtime_cost(vms)

        return {
            "mtd_total": 0,
            "real_time_cost": realtime_cost,
            "forecast": realtime_cost,
            "currency": "USD",
            "source": "realtime_only",
        }


@router.get("/daily")
def get_daily_cost(user: User = Depends(get_current_user)):
    try:
        ce = get_ce_client()

        end = datetime.today().strftime("%Y-%m-%d")
        start = (datetime.today() - timedelta(days=29)).strftime("%Y-%m-%d")

        resp = ce.get_cost_and_usage(
            TimePeriod={"Start": start, "End": end},
            Granularity="DAILY",
            Metrics=["UnblendedCost"],
        )

        return [
            {
                "date": r["TimePeriod"]["Start"],
                "amount": float(r["Total"]["UnblendedCost"]["Amount"]),
            }
            for r in resp["ResultsByTime"]
        ]

    except Exception:
        return []


@router.get("/services")
def get_service_cost(user: User = Depends(get_current_user)):
    try:
        ce = get_ce_client()

        today = datetime.today()
        start = today.replace(day=1).strftime("%Y-%m-%d")
        end = today.strftime("%Y-%m-%d")

        resp = ce.get_cost_and_usage(
            TimePeriod={"Start": start, "End": end},
            Granularity="MONTHLY",
            Metrics=["UnblendedCost"],
            GroupBy=[{"Type": "DIMENSION", "Key": "SERVICE"}],
        )

        services = []

        for r in resp["ResultsByTime"]:
            for g in r["Groups"]:
                amt = float(g["Metrics"]["UnblendedCost"]["Amount"])
                if amt > 0:
                    services.append({
                        "service": g["Keys"][0],
                        "amount": round(amt, 2)
                    })

        return sorted(services, key=lambda x: x["amount"], reverse=True)[:8]

    except Exception:
        return []


# 🔥 Per VM real-time cost
@router.get("/vm/{vm_id}/realtime")
def get_vm_cost(vm_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    vm = db.query(VM).filter(VM.id == vm_id).first()

    if not vm:
        return {"error": "VM not found"}

    if vm.state == "running" and vm.start_time:
        price = 0.0104
        hours = (datetime.utcnow() - vm.start_time).total_seconds() / 3600

        return {
            "vm": vm.name,
            "hours": round(hours, 2),
            "cost": round(hours * price, 4),
        }

    return {"vm": vm.name, "cost": 0}
# --------------------------------------------------
# FORECAST
# --------------------------------------------------
@router.get("/forecast")
def get_forecast(user: User = Depends(get_current_user)):
    try:
        ce    = get_ce_client()
        today = datetime.today()
        start = today.strftime("%Y-%m-%d")
        end   = (today + timedelta(days=90)).strftime("%Y-%m-%d")
        resp  = ce.get_cost_forecast(
            TimePeriod={"Start": start, "End": end},
            Metric="UNBLENDED_COST",
            Granularity="MONTHLY",
        )
        return [{"month": r["TimePeriod"]["Start"][:7], "amount": round(float(r["MeanValue"]),2), "lower": round(float(r["PredictionIntervalLowerBound"]),2), "upper": round(float(r["PredictionIntervalUpperBound"]),2)} for r in resp["ForecastResultsByTime"]]
    except Exception as e:
        print(f"Forecast error: {e}")
        return []


@router.get("/monthly")
def get_monthly_cost(months: int = 6, user: User = Depends(get_current_user)):
    """Last N months cost grouped by service — for the 6-month history view."""
    try:
        ce    = get_ce_client()
        today = datetime.today()
        # End = start of current month (exclusive)
        end_dt   = today.replace(day=1)
        start_dt = end_dt
        for _ in range(months):
            start_dt = (start_dt - timedelta(days=1)).replace(day=1)

        end   = end_dt.strftime("%Y-%m-%d")
        start = start_dt.strftime("%Y-%m-%d")

        resp = ce.get_cost_and_usage(
            TimePeriod={"Start": start, "End": end},
            Granularity="MONTHLY",
            Metrics=["UnblendedCost"],
            GroupBy=[{"Type": "DIMENSION", "Key": "SERVICE"}],
        )

        result = []
        for r in resp["ResultsByTime"]:
            month    = r["TimePeriod"]["Start"][:7]
            services = []
            total    = 0.0
            for g in r["Groups"]:
                amt = float(g["Metrics"]["UnblendedCost"]["Amount"])
                if amt > 0.001:
                    svc = g["Keys"][0].replace("Amazon ", "").replace("AWS ", "")
                    services.append({"service": svc, "amount": round(amt, 2)})
                    total += amt
            services.sort(key=lambda x: x["amount"], reverse=True)
            result.append({
                "month":    month,
                "total":    round(total, 2),
                "services": services[:6],
            })
        return result
    except Exception as e:
        print(f"Monthly cost error: {e}")
        return []


@router.get("/vms/realtime")
def get_all_vms_realtime(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    pricing = {"t2.micro":0.0116,"t2.medium":0.0464,"t2.large":0.0928,"t2.2xlarge":0.3712,"t3.micro":0.0104,"t3.medium":0.0416,"t3.large":0.0832,"t3a.medium":0.0376,"t3a.large":0.0752,"t3a.xlarge":0.1504,"t3a.2xlarge":0.3008,"c5a.2xlarge":0.3080,"g5.2xlarge":1.2120}
    vms = db.query(VM).all()
    result = []
    for vm in vms:
        price = pricing.get(vm.instance_type, 0.0104)
        hours = (datetime.utcnow() - vm.start_time).total_seconds() / 3600 if vm.state == "running" and vm.start_time else 0
        result.append({"vm_id": vm.id, "name": vm.name, "instance_type": vm.instance_type, "state": vm.state, "hours_running": round(hours,2), "cost_so_far": round(hours * price, 4), "cost_per_hour": price, "estimated_monthly": round(price*24*30,2)})
    return sorted(result, key=lambda x: x["cost_so_far"], reverse=True)


# ── SERVICE ICONS ──────────────────────────────────────────────────────────────
_SERVICE_META = {
    "Amazon Elastic Compute Cloud - Compute": {"icon": "🖥", "short": "EC2"},
    "Amazon Elastic Container Service for Kubernetes": {"icon": "⚙️", "short": "EKS"},
    "Amazon Simple Storage Service": {"icon": "🪣", "short": "S3"},
    "Amazon Relational Database Service": {"icon": "🗄", "short": "RDS"},
    "Amazon Virtual Private Cloud": {"icon": "🔒", "short": "VPC"},
    "AWS Lambda": {"icon": "λ", "short": "Lambda"},
    "Amazon CloudFront": {"icon": "🌐", "short": "CloudFront"},
    "Elastic Load Balancing": {"icon": "⚖️", "short": "ELB"},
    "Amazon DynamoDB": {"icon": "📊", "short": "DynamoDB"},
    "Amazon ElastiCache": {"icon": "⚡", "short": "ElastiCache"},
    "AWS Key Management Service": {"icon": "🔑", "short": "KMS"},
    "Amazon Route 53": {"icon": "🌍", "short": "Route53"},
    "Amazon Elastic Block Store": {"icon": "💾", "short": "EBS"},
    "Amazon Elastic Container Registry": {"icon": "📦", "short": "ECR"},
    "AWS CloudTrail": {"icon": "📋", "short": "CloudTrail"},
    "Amazon CloudWatch": {"icon": "📈", "short": "CloudWatch"},
    "AWS Config": {"icon": "⚙", "short": "Config"},
    "AWS Secrets Manager": {"icon": "🔐", "short": "Secrets"},
    "Amazon Simple Notification Service": {"icon": "🔔", "short": "SNS"},
    "Amazon Simple Queue Service": {"icon": "📨", "short": "SQS"},
    "Amazon EC2 Container Registry (ECR)": {"icon": "📦", "short": "ECR"},
}


@router.get("/resources")
def get_resource_costs(user: User = Depends(get_current_user)):
    """
    Per-service MTD cost breakdown from AWS Cost Explorer.
    Groups by SERVICE for the current month to date, returning
    each service with its cost, percentage share, icon and trend.
    """
    try:
        ce    = get_ce_client()
        today = datetime.today()

        # Month-to-date window
        mtd_start = today.replace(day=1).strftime("%Y-%m-%d")
        mtd_end   = today.strftime("%Y-%m-%d")

        # Previous month same window for trend comparison
        prev_end   = today.replace(day=1) - timedelta(days=1)
        prev_start = prev_end.replace(day=1).strftime("%Y-%m-%d")
        prev_end_s = prev_end.strftime("%Y-%m-%d")

        def fetch_by_service(start, end):
            if start == end:
                return {}
            resp = ce.get_cost_and_usage(
                TimePeriod={"Start": start, "End": end},
                Granularity="MONTHLY",
                Metrics=["UnblendedCost"],
                GroupBy=[{"Type": "DIMENSION", "Key": "SERVICE"}],
            )
            svc_map = {}
            for period in resp["ResultsByTime"]:
                for g in period["Groups"]:
                    svc = g["Keys"][0]
                    amt = float(g["Metrics"]["UnblendedCost"]["Amount"])
                    svc_map[svc] = svc_map.get(svc, 0) + amt
            return svc_map

        current  = fetch_by_service(mtd_start, mtd_end)
        previous = fetch_by_service(prev_start, prev_end_s)

        total = sum(current.values())

        resources = []
        for svc, amt in current.items():
            if amt < 0.001:
                continue
            meta  = _SERVICE_META.get(svc, {})
            prev  = previous.get(svc, 0)
            # Trend: % change vs same-number-of-days last month
            days_elapsed = today.day
            days_in_prev = prev_end.day
            prev_daily   = (prev / days_in_prev) if days_in_prev > 0 else 0
            curr_daily   = (amt  / days_elapsed) if days_elapsed > 0 else 0
            if prev_daily > 0:
                trend_pct = round(((curr_daily - prev_daily) / prev_daily) * 100, 1)
            else:
                trend_pct = None

            # Shorten long service names
            short_name = meta.get("short") or (
                svc.replace("Amazon ", "").replace("AWS ", "")
            )

            resources.append({
                "service":      svc,
                "short_name":   short_name,
                "icon":         meta.get("icon", "☁️"),
                "amount":       round(amt, 4),
                "percent":      round((amt / total) * 100, 1) if total > 0 else 0,
                "trend_pct":    trend_pct,
                "prev_month":   round(prev, 4),
            })

        resources.sort(key=lambda x: x["amount"], reverse=True)
        return {
            "total":     round(total, 2),
            "currency":  "USD",
            "period":    f"{mtd_start} → {mtd_end}",
            "resources": resources,
        }

    except Exception as e:
        print(f"Resource cost error: {e}")
        return {"total": 0, "currency": "USD", "period": "", "resources": [], "error": str(e)}