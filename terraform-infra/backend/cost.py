from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
import boto3
from datetime import datetime, timedelta

from database import get_db
from models import User, VM
from routers.auth import get_current_user

router = APIRouter(prefix="/cost", tags=["cost"])


# -----------------------------
# AWS Cost Explorer
# -----------------------------
def get_ce_client():
    return boto3.client("ce", region_name="us-east-1")


# -----------------------------
# REAL-TIME COST CALCULATION
# -----------------------------
def calculate_realtime_cost(vms):
    pricing = {
        "t3.micro": 0.0104,
        "t3.small": 0.0208,
        "t3.medium": 0.0416,
    }

    total = 0

    for vm in vms:
        if vm.state == "running":
            instance_type = getattr(vm, "instance_type", "t3.micro")
            price = pricing.get(instance_type, 0.01)

            start_time = getattr(vm, "start_time", None)

            if start_time:
                hours = (datetime.utcnow() - start_time).total_seconds() / 3600
                total += hours * price
            else:
                total += price

    return round(total, 2)


# -----------------------------
# OVERVIEW API
# -----------------------------
@router.get("/overview")
def get_cost_overview(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    vms = db.query(VM).all()

    # 🔥 REAL-TIME COST
    realtime_cost = calculate_realtime_cost(vms)

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
        except:
            pass

        return {
            "real_time_cost": realtime_cost,   # 🔥 NEW
            "mtd_cost": round(mtd, 2),
            "forecast": round(mtd + forecast, 2),
            "currency": "USD",
            "source": "hybrid"
        }

    except Exception as e:
        print(f"Cost error: {e}")

        return {
            "real_time_cost": realtime_cost,
            "mtd_cost": 0,
            "forecast": realtime_cost,
            "currency": "USD",
            "source": "realtime_only"
        }


# -----------------------------
# DAILY COST
# -----------------------------
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
                "amount": round(float(r["Total"]["UnblendedCost"]["Amount"]), 4)
            }
            for r in resp["ResultsByTime"]
        ]

    except:
        return []


# -----------------------------
# SERVICE COST
# -----------------------------
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

        return sorted(services, key=lambda x: x["amount"], reverse=True)[:10]

    except:
        return []


# -----------------------------
# FORECAST
# -----------------------------
@router.get("/forecast")
def get_forecast(user: User = Depends(get_current_user)):
    try:
        ce = get_ce_client()

        today = datetime.today()
        start = today.strftime("%Y-%m-%d")
        end = (today + timedelta(days=90)).strftime("%Y-%m-%d")

        resp = ce.get_cost_forecast(
            TimePeriod={"Start": start, "End": end},
            Metric="UNBLENDED_COST",
            Granularity="MONTHLY",
        )

        return [
            {
                "month": r["TimePeriod"]["Start"][:7],
                "amount": round(float(r["MeanValue"]), 2)
            }
            for r in resp["ForecastResultsByTime"]
        ]

    except:
        return []