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