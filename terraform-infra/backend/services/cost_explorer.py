"""
Cost data service.
Tries AWS Cost Explorer first; falls back to mock data if boto3 call fails
(e.g. missing permissions, localdev without credentials).
"""
import random
from datetime import datetime, timedelta

import boto3
from botocore.exceptions import ClientError, NoCredentialsError
import config


def _ce_client():
    return boto3.client("ce", region_name="us-east-1")  # Cost Explorer is global, uses us-east-1


# ── MTD total ─────────────────────────────────────────────────

def get_mtd_total() -> float:
    start = datetime.utcnow().replace(day=1).strftime("%Y-%m-%d")
    end   = datetime.utcnow().strftime("%Y-%m-%d")
    try:
        resp = _ce_client().get_cost_and_usage(
            TimePeriod={"Start": start, "End": end},
            Granularity="MONTHLY",
            Metrics=["UnblendedCost"],
        )
        amount = resp["ResultsByTime"][0]["Total"]["UnblendedCost"]["Amount"]
        return round(float(amount) * 83, 2)  # USD → INR approx
    except (ClientError, NoCredentialsError, IndexError, KeyError):
        return _mock_mtd()


def _mock_mtd() -> float:
    # Deterministic mock based on current day of month
    day = datetime.utcnow().day
    return round(day * 1450.75, 2)


# ── Daily costs (last N days) ─────────────────────────────────

def get_daily_costs(days: int = 30) -> list[dict]:
    end   = datetime.utcnow()
    start = end - timedelta(days=days)
    try:
        resp = _ce_client().get_cost_and_usage(
            TimePeriod={
                "Start": start.strftime("%Y-%m-%d"),
                "End":   end.strftime("%Y-%m-%d"),
            },
            Granularity="DAILY",
            Metrics=["UnblendedCost"],
        )
        return [
            {
                "date":   r["TimePeriod"]["Start"],
                "amount": round(float(r["Total"]["UnblendedCost"]["Amount"]) * 83, 2),
            }
            for r in resp["ResultsByTime"]
        ]
    except (ClientError, NoCredentialsError):
        return _mock_daily(days)


def _mock_daily(days: int) -> list[dict]:
    result = []
    base   = datetime.utcnow() - timedelta(days=days)
    random.seed(42)
    for i in range(days):
        day = base + timedelta(days=i)
        result.append({
            "date":   day.strftime("%Y-%m-%d"),
            "amount": round(random.uniform(800, 3200), 2),
        })
    return result


# ── Service breakdown ─────────────────────────────────────────

def get_service_breakdown() -> list[dict]:
    start = datetime.utcnow().replace(day=1).strftime("%Y-%m-%d")
    end   = datetime.utcnow().strftime("%Y-%m-%d")
    try:
        resp = _ce_client().get_cost_and_usage(
            TimePeriod={"Start": start, "End": end},
            Granularity="MONTHLY",
            Metrics=["UnblendedCost"],
            GroupBy=[{"Type": "DIMENSION", "Key": "SERVICE"}],
        )
        groups = resp["ResultsByTime"][0]["Groups"]
        return [
            {
                "service": g["Keys"][0],
                "amount":  round(float(g["Metrics"]["UnblendedCost"]["Amount"]) * 83, 2),
            }
            for g in groups
            if float(g["Metrics"]["UnblendedCost"]["Amount"]) > 0
        ]
    except (ClientError, NoCredentialsError, IndexError):
        return _mock_services()


def _mock_services() -> list[dict]:
    return [
        {"service": "Amazon EC2",              "amount": 28450.00},
        {"service": "Amazon S3",               "amount": 4210.50},
        {"service": "Amazon RDS",              "amount": 9870.25},
        {"service": "Amazon EKS",              "amount": 6540.00},
        {"service": "AWS Data Transfer",       "amount": 1230.75},
        {"service": "Other",                   "amount": 850.00},
    ]
