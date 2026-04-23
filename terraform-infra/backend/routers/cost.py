from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import Optional
import boto3
import json
from datetime import datetime, timedelta

from database import get_db
from models import User, VM
from routers.auth import get_current_user

router = APIRouter(prefix="/cost", tags=["cost"])

# ── Accurate reference pricing (on-demand, Linux) ────────────────────────────
# AWS: ap-south-1 (Mumbai)  |  Azure: Central India  |  GCP: asia-south1
# vcpu/ram fields are used for the smart fallback when an exact type is missing
_REFERENCE = {
    "t2.micro":     {"aws":0.0116,"azure":0.0114,"gcp":0.0084,  "vcpu":1,  "ram":1,    "azure_equiv":"B1s",           "azure_specs":"1 vCPU · 1 GiB",    "gcp_equiv":"e2-micro",         "gcp_specs":"2 vCPU · 1 GiB"},
    "t2.small":     {"aws":0.0232,"azure":0.0214,"gcp":0.0168,  "vcpu":1,  "ram":2,    "azure_equiv":"B1ms",          "azure_specs":"1 vCPU · 2 GiB",    "gcp_equiv":"e2-small",         "gcp_specs":"2 vCPU · 2 GiB"},
    "t2.medium":    {"aws":0.0464,"azure":0.0466,"gcp":0.0335,  "vcpu":2,  "ram":4,    "azure_equiv":"B2s",           "azure_specs":"2 vCPU · 4 GiB",    "gcp_equiv":"e2-medium",        "gcp_specs":"2 vCPU · 4 GiB"},
    "t3.micro":     {"aws":0.0116,"azure":0.0114,"gcp":0.0084,  "vcpu":2,  "ram":1,    "azure_equiv":"B1s",           "azure_specs":"1 vCPU · 1 GiB",    "gcp_equiv":"e2-micro",         "gcp_specs":"2 vCPU · 1 GiB"},
    "t3.medium":    {"aws":0.0464,"azure":0.0466,"gcp":0.0335,  "vcpu":2,  "ram":4,    "azure_equiv":"B2s",           "azure_specs":"2 vCPU · 4 GiB",    "gcp_equiv":"e2-medium",        "gcp_specs":"2 vCPU · 4 GiB"},
    "t3.large":     {"aws":0.0928,"azure":0.0932,"gcp":0.0670,  "vcpu":2,  "ram":8,    "azure_equiv":"B2ms",          "azure_specs":"2 vCPU · 8 GiB",    "gcp_equiv":"e2-standard-2",    "gcp_specs":"2 vCPU · 8 GiB"},
    "t3.xlarge":    {"aws":0.1856,"azure":0.1864,"gcp":0.1340,  "vcpu":4,  "ram":16,   "azure_equiv":"B4ms",          "azure_specs":"4 vCPU · 16 GiB",   "gcp_equiv":"e2-standard-4",    "gcp_specs":"4 vCPU · 16 GiB"},
    "t3.2xlarge":   {"aws":0.3712,"azure":0.3320,"gcp":0.2684,  "vcpu":8,  "ram":32,   "azure_equiv":"B8ms",          "azure_specs":"8 vCPU · 32 GiB",   "gcp_equiv":"e2-standard-8",    "gcp_specs":"8 vCPU · 32 GiB"},
    "m5.large":     {"aws":0.1060,"azure":0.1100,"gcp":0.0950,  "vcpu":2,  "ram":8,    "azure_equiv":"D2s v3",        "azure_specs":"2 vCPU · 8 GiB",    "gcp_equiv":"n2-standard-2",    "gcp_specs":"2 vCPU · 8 GiB"},
    "m5.xlarge":    {"aws":0.2120,"azure":0.2200,"gcp":0.1900,  "vcpu":4,  "ram":16,   "azure_equiv":"D4s v3",        "azure_specs":"4 vCPU · 16 GiB",   "gcp_equiv":"n2-standard-4",    "gcp_specs":"4 vCPU · 16 GiB"},
    "m5.2xlarge":   {"aws":0.4240,"azure":0.4400,"gcp":0.3800,  "vcpu":8,  "ram":32,   "azure_equiv":"D8s v3",        "azure_specs":"8 vCPU · 32 GiB",   "gcp_equiv":"n2-standard-8",    "gcp_specs":"8 vCPU · 32 GiB"},
    "m5.4xlarge":   {"aws":0.8480,"azure":0.7680,"gcp":0.7769,  "vcpu":16, "ram":64,   "azure_equiv":"D16s v5",       "azure_specs":"16 vCPU · 64 GiB",  "gcp_equiv":"n2-standard-16",   "gcp_specs":"16 vCPU · 64 GiB"},
    "m6i.large":    {"aws":0.1120,"azure":0.0960,"gcp":0.0971,  "vcpu":2,  "ram":8,    "azure_equiv":"D2s v5",        "azure_specs":"2 vCPU · 8 GiB",    "gcp_equiv":"n2-standard-2",    "gcp_specs":"2 vCPU · 8 GiB"},
    "m6i.xlarge":   {"aws":0.2240,"azure":0.1920,"gcp":0.1942,  "vcpu":4,  "ram":16,   "azure_equiv":"D4s v5",        "azure_specs":"4 vCPU · 16 GiB",   "gcp_equiv":"n2-standard-4",    "gcp_specs":"4 vCPU · 16 GiB"},
    "m6i.2xlarge":  {"aws":0.4480,"azure":0.3840,"gcp":0.3885,  "vcpu":8,  "ram":32,   "azure_equiv":"D8s v5",        "azure_specs":"8 vCPU · 32 GiB",   "gcp_equiv":"n2-standard-8",    "gcp_specs":"8 vCPU · 32 GiB"},
    "m6i.4xlarge":  {"aws":0.8960,"azure":0.7680,"gcp":0.7769,  "vcpu":16, "ram":64,   "azure_equiv":"D16s v5",       "azure_specs":"16 vCPU · 64 GiB",  "gcp_equiv":"n2-standard-16",   "gcp_specs":"16 vCPU · 64 GiB"},
    "m6i.8xlarge":  {"aws":1.7920,"azure":1.5360,"gcp":1.5539,  "vcpu":32, "ram":128,  "azure_equiv":"D32s v5",       "azure_specs":"32 vCPU · 128 GiB", "gcp_equiv":"n2-standard-32",   "gcp_specs":"32 vCPU · 128 GiB"},
    "m6i.16xlarge": {"aws":3.5840,"azure":3.0720,"gcp":3.1077,  "vcpu":64, "ram":256,  "azure_equiv":"D64s v5",       "azure_specs":"64 vCPU · 256 GiB", "gcp_equiv":"n2-standard-64",   "gcp_specs":"64 vCPU · 256 GiB"},
    "m6i.32xlarge": {"aws":7.1680,"azure":4.6080,"gcp":6.2154,  "vcpu":128,"ram":512,  "azure_equiv":"D96s v5",       "azure_specs":"96 vCPU · 384 GiB", "gcp_equiv":"n2-standard-128",  "gcp_specs":"128 vCPU · 512 GiB"},
    "c5.large":     {"aws":0.0960,"azure":0.0872,"gcp":0.0760,  "vcpu":2,  "ram":4,    "azure_equiv":"F2s v2",        "azure_specs":"2 vCPU · 4 GiB",    "gcp_equiv":"c2-standard-4",    "gcp_specs":"4 vCPU · 16 GiB"},
    "c5.xlarge":    {"aws":0.1920,"azure":0.1744,"gcp":0.1520,  "vcpu":4,  "ram":8,    "azure_equiv":"F4s v2",        "azure_specs":"4 vCPU · 8 GiB",    "gcp_equiv":"c2-standard-4",    "gcp_specs":"4 vCPU · 16 GiB"},
    "c5.2xlarge":   {"aws":0.3840,"azure":0.3488,"gcp":0.3040,  "vcpu":8,  "ram":16,   "azure_equiv":"F8s v2",        "azure_specs":"8 vCPU · 16 GiB",   "gcp_equiv":"c2-standard-8",    "gcp_specs":"8 vCPU · 32 GiB"},
    "c5.4xlarge":   {"aws":0.7680,"azure":0.6760,"gcp":0.8352,  "vcpu":16, "ram":32,   "azure_equiv":"F16s v2",       "azure_specs":"16 vCPU · 32 GiB",  "gcp_equiv":"c2-standard-16",   "gcp_specs":"16 vCPU · 64 GiB"},
    "c5.9xlarge":   {"aws":1.7280,"azure":1.3520,"gcp":1.5660,  "vcpu":36, "ram":72,   "azure_equiv":"F32s v2",       "azure_specs":"32 vCPU · 64 GiB",  "gcp_equiv":"c2-standard-30",   "gcp_specs":"30 vCPU · 120 GiB"},
    "c5.18xlarge":  {"aws":3.4560,"azure":2.7040,"gcp":3.1321,  "vcpu":72, "ram":144,  "azure_equiv":"F64s v2",       "azure_specs":"64 vCPU · 128 GiB", "gcp_equiv":"c2-standard-60",   "gcp_specs":"60 vCPU · 240 GiB"},
    "c5a.xlarge":   {"aws":0.1720,"azure":0.1744,"gcp":0.1520,  "vcpu":4,  "ram":8,    "azure_equiv":"F4s v2",        "azure_specs":"4 vCPU · 8 GiB",    "gcp_equiv":"c2-standard-4",    "gcp_specs":"4 vCPU · 16 GiB"},
    "c6i.xlarge":   {"aws":0.2040,"azure":0.1690,"gcp":0.1942,  "vcpu":4,  "ram":8,    "azure_equiv":"F4s v2",        "azure_specs":"4 vCPU · 8 GiB",    "gcp_equiv":"n2-standard-4",    "gcp_specs":"4 vCPU · 16 GiB"},
    "c6i.4xlarge":  {"aws":0.8160,"azure":0.6760,"gcp":0.7769,  "vcpu":16, "ram":32,   "azure_equiv":"F16s v2",       "azure_specs":"16 vCPU · 32 GiB",  "gcp_equiv":"n2-standard-16",   "gcp_specs":"16 vCPU · 64 GiB"},
    "c6i.16xlarge": {"aws":3.2640,"azure":2.7040,"gcp":3.1077,  "vcpu":64, "ram":128,  "azure_equiv":"F64s v2",       "azure_specs":"64 vCPU · 128 GiB", "gcp_equiv":"n2-standard-64",   "gcp_specs":"64 vCPU · 256 GiB"},
    "r5.large":     {"aws":0.1440,"azure":0.1306,"gcp":0.1184,  "vcpu":2,  "ram":16,   "azure_equiv":"E2s v3",        "azure_specs":"2 vCPU · 16 GiB",   "gcp_equiv":"n1-highmem-2",     "gcp_specs":"2 vCPU · 13 GiB"},
    "r5.xlarge":    {"aws":0.2880,"azure":0.2612,"gcp":0.2368,  "vcpu":4,  "ram":32,   "azure_equiv":"E4s v3",        "azure_specs":"4 vCPU · 32 GiB",   "gcp_equiv":"n1-highmem-4",     "gcp_specs":"4 vCPU · 26 GiB"},
    "r5.2xlarge":   {"aws":0.5760,"azure":0.5224,"gcp":0.4736,  "vcpu":8,  "ram":64,   "azure_equiv":"E8s v3",        "azure_specs":"8 vCPU · 64 GiB",   "gcp_equiv":"n1-highmem-8",     "gcp_specs":"8 vCPU · 52 GiB"},
    "r5.4xlarge":   {"aws":1.0080,"azure":1.0080,"gcp":1.0482,  "vcpu":16, "ram":128,  "azure_equiv":"E16s v5",       "azure_specs":"16 vCPU · 128 GiB", "gcp_equiv":"n2-highmem-16",    "gcp_specs":"16 vCPU · 128 GiB"},
    "r5.8xlarge":   {"aws":2.0160,"azure":2.0160,"gcp":2.0963,  "vcpu":32, "ram":256,  "azure_equiv":"E32s v5",       "azure_specs":"32 vCPU · 256 GiB", "gcp_equiv":"n2-highmem-32",    "gcp_specs":"32 vCPU · 256 GiB"},
    "r5.16xlarge":  {"aws":4.0320,"azure":4.0320,"gcp":4.1926,  "vcpu":64, "ram":512,  "azure_equiv":"E64s v5",       "azure_specs":"64 vCPU · 512 GiB", "gcp_equiv":"n2-highmem-64",    "gcp_specs":"64 vCPU · 512 GiB"},
    "r6i.large":    {"aws":0.1440,"azure":0.1260,"gcp":0.1310,  "vcpu":2,  "ram":16,   "azure_equiv":"E2s v5",        "azure_specs":"2 vCPU · 16 GiB",   "gcp_equiv":"n2-highmem-2",     "gcp_specs":"2 vCPU · 16 GiB"},
    "r6i.xlarge":   {"aws":0.2880,"azure":0.2520,"gcp":0.2620,  "vcpu":4,  "ram":32,   "azure_equiv":"E4s v5",        "azure_specs":"4 vCPU · 32 GiB",   "gcp_equiv":"n2-highmem-4",     "gcp_specs":"4 vCPU · 32 GiB"},
    "r6i.4xlarge":  {"aws":1.0080,"azure":1.0080,"gcp":1.0482,  "vcpu":16, "ram":128,  "azure_equiv":"E16s v5",       "azure_specs":"16 vCPU · 128 GiB", "gcp_equiv":"n2-highmem-16",    "gcp_specs":"16 vCPU · 128 GiB"},
    "r6i.16xlarge": {"aws":4.0320,"azure":4.0320,"gcp":4.1926,  "vcpu":64, "ram":512,  "azure_equiv":"E64s v5",       "azure_specs":"64 vCPU · 512 GiB", "gcp_equiv":"n2-highmem-64",    "gcp_specs":"64 vCPU · 512 GiB"},
    "g4dn.xlarge":  {"aws":0.7360,"azure":0.5260,"gcp":0.5600,  "vcpu":4,  "ram":16,   "azure_equiv":"NC4as T4 v3",   "azure_specs":"4 vCPU · 28 GiB",   "gcp_equiv":"n1-std-4 + T4",    "gcp_specs":"4 vCPU · 15 GiB"},
    "g4dn.2xlarge": {"aws":1.0530,"azure":0.9120,"gcp":0.8600,  "vcpu":8,  "ram":32,   "azure_equiv":"NC8as T4 v3",   "azure_specs":"8 vCPU · 56 GiB",   "gcp_equiv":"n1-std-8 + T4",    "gcp_specs":"8 vCPU · 30 GiB"},
    "g4dn.4xlarge": {"aws":1.2040,"azure":1.1240,"gcp":1.1020,  "vcpu":16, "ram":64,   "azure_equiv":"NC16as T4 v3",  "azure_specs":"16 vCPU · 110 GiB", "gcp_equiv":"n1-std-16 + T4",   "gcp_specs":"16 vCPU · 60 GiB"},
    "g5.xlarge":    {"aws":1.0060,"azure":1.2480,"gcp":1.1020,  "vcpu":4,  "ram":16,   "azure_equiv":"NC4as A10 v4",  "azure_specs":"4 vCPU · 14 GiB",   "gcp_equiv":"a2-highgpu-1g",    "gcp_specs":"12 vCPU · 85 GiB"},
    "g5.2xlarge":   {"aws":1.2120,"azure":1.2480,"gcp":1.1020,  "vcpu":8,  "ram":32,   "azure_equiv":"NC8as A10 v4",  "azure_specs":"8 vCPU · 56 GiB",   "gcp_equiv":"a2-highgpu-1g",    "gcp_specs":"12 vCPU · 85 GiB"},
    "p3.2xlarge":   {"aws":3.0600,"azure":2.8080,"gcp":2.4800,  "vcpu":8,  "ram":61,   "azure_equiv":"NC6s v3",       "azure_specs":"6 vCPU · 112 GiB",  "gcp_equiv":"a2-highgpu-1g",    "gcp_specs":"12 vCPU · 85 GiB"},
    "t4g.medium":   {"aws":0.0376,"azure":0.0473,"gcp":0.0280,  "vcpu":2,  "ram":4,    "azure_equiv":"Bpsv2-2",       "azure_specs":"2 vCPU · 4 GiB",    "gcp_equiv":"t2a-standard-2",   "gcp_specs":"2 vCPU · 8 GiB"},
    "t4g.large":    {"aws":0.0752,"azure":0.0946,"gcp":0.0560,  "vcpu":2,  "ram":8,    "azure_equiv":"Bpsv2-4",       "azure_specs":"4 vCPU · 8 GiB",    "gcp_equiv":"t2a-standard-4",   "gcp_specs":"4 vCPU · 16 GiB"},
    "t4g.xlarge":   {"aws":0.1344,"azure":0.1864,"gcp":0.1120,  "vcpu":4,  "ram":16,   "azure_equiv":"B4ms",          "azure_specs":"4 vCPU · 16 GiB",   "gcp_equiv":"t2a-standard-4",   "gcp_specs":"4 vCPU · 16 GiB"},
    "m6g.large":    {"aws":0.0880,"azure":0.0946,"gcp":0.0560,  "vcpu":2,  "ram":8,    "azure_equiv":"Dplds v5",      "azure_specs":"2 vCPU · 8 GiB",    "gcp_equiv":"t2a-standard-2",   "gcp_specs":"2 vCPU · 8 GiB"},
    "m6g.xlarge":   {"aws":0.1544,"azure":0.1920,"gcp":0.1340,  "vcpu":4,  "ram":16,   "azure_equiv":"D4s v5",        "azure_specs":"4 vCPU · 16 GiB",   "gcp_equiv":"t2a-standard-4",   "gcp_specs":"4 vCPU · 16 GiB"},
    "m6g.4xlarge":  {"aws":0.6160,"azure":0.7680,"gcp":0.5368,  "vcpu":16, "ram":64,   "azure_equiv":"D16s v5",       "azure_specs":"16 vCPU · 64 GiB",  "gcp_equiv":"t2a-standard-16",  "gcp_specs":"16 vCPU · 64 GiB"},
    "m6g.16xlarge": {"aws":2.4640,"azure":3.0720,"gcp":2.1472,  "vcpu":64, "ram":256,  "azure_equiv":"D64s v5",       "azure_specs":"64 vCPU · 256 GiB", "gcp_equiv":"t2a-standard-64",  "gcp_specs":"64 vCPU · 256 GiB"},
}

def _closest_ref(instance_type, aws_live_price=None):
    """Return reference data for instance_type; falls back to closest-spec entry with scaled prices."""
    if instance_type in _REFERENCE:
        return _REFERENCE[instance_type]
    best_key, best_score = None, float("inf")
    for k, v in _REFERENCE.items():
        if "vcpu" not in v:
            continue
        # Use AWS price ratio as a proxy when specs unknown
        if aws_live_price and v["aws"] > 0:
            score = abs(aws_live_price / v["aws"] - 1)
        else:
            score = float("inf")
        if score < best_score:
            best_score = score
            best_key = k
    if best_key:
        base = _REFERENCE[best_key]
        scale = (aws_live_price or base["aws"]) / max(base["aws"], 0.001)
        return {
            "aws":         aws_live_price or base["aws"],
            "azure":       round(base["azure"] * scale, 4),
            "gcp":         round(base["gcp"]   * scale, 4),
            "azure_equiv": base["azure_equiv"],
            "azure_specs": base.get("azure_specs", ""),
            "gcp_equiv":   base["gcp_equiv"],
            "gcp_specs":   base.get("gcp_specs", ""),
        }
    return {"aws": aws_live_price or 0.05, "azure": round((aws_live_price or 0.05)*0.92,4),
            "gcp": round((aws_live_price or 0.05)*0.88,4),
            "azure_equiv":"equivalent","azure_specs":"","gcp_equiv":"equivalent","gcp_specs":""}

_REGION_NAMES = {
    "ap-south-1":    "Asia Pacific (Mumbai)",
    "ap-south-2":    "Asia Pacific (Hyderabad)",
    "us-east-1":     "US East (N. Virginia)",
    "us-east-2":     "US East (Ohio)",
    "us-west-1":     "US West (N. California)",
    "us-west-2":     "US West (Oregon)",
    "eu-west-1":     "Europe (Ireland)",
    "eu-west-2":     "Europe (London)",
    "eu-central-1":  "Europe (Frankfurt)",
    "eu-north-1":    "Europe (Stockholm)",
    "ap-southeast-1":"Asia Pacific (Singapore)",
    "ap-southeast-2":"Asia Pacific (Sydney)",
    "ap-northeast-1":"Asia Pacific (Tokyo)",
    "ap-northeast-2":"Asia Pacific (Seoul)",
    "ca-central-1":  "Canada (Central)",
    "sa-east-1":     "South America (Sao Paulo)",
    "me-south-1":    "Middle East (Bahrain)",
    "af-south-1":    "Africa (Cape Town)",
}


@router.get("/compare")
def compare_instance_costs(
    instance_type: str = "t3.medium",
    region:        str = "ap-south-1",
    user: User = Depends(get_current_user),
):
    """Return on-demand pricing for AWS (live via Pricing API) + Azure/GCP reference."""

    # ── Try live AWS price ────────────────────────────────────────────────────
    aws_price  = None
    aws_source = "reference"
    try:
        pricing  = boto3.client("pricing", region_name="us-east-1")
        location = _REGION_NAMES.get(region, "Asia Pacific (Mumbai)")
        resp = pricing.get_products(
            ServiceCode="AmazonEC2",
            Filters=[
                {"Type":"TERM_MATCH","Field":"instanceType",   "Value":instance_type},
                {"Type":"TERM_MATCH","Field":"location",       "Value":location},
                {"Type":"TERM_MATCH","Field":"operatingSystem","Value":"Linux"},
                {"Type":"TERM_MATCH","Field":"tenancy",        "Value":"Shared"},
                {"Type":"TERM_MATCH","Field":"capacitystatus", "Value":"Used"},
                {"Type":"TERM_MATCH","Field":"preInstalledSw", "Value":"NA"},
            ],
        )
        for price_str in resp.get("PriceList", []):
            terms = json.loads(price_str).get("terms", {}).get("OnDemand", {})
            for term in terms.values():
                for dim in term.get("priceDimensions", {}).values():
                    usd = float(dim["pricePerUnit"].get("USD", 0))
                    if usd > 0:
                        aws_price  = round(usd, 6)
                        aws_source = "live"
                        break
    except Exception as e:
        print(f"[cost/compare] AWS Pricing API error: {e}")

    ref = _closest_ref(instance_type, aws_price)

    return {
        "instance_type": instance_type,
        "region":        region,
        "aws": {
            "price":       aws_price if aws_price is not None else ref["aws"],
            "source":      aws_source,
            "currency":    "USD",
        },
        "azure": {
            "price":        ref["azure"],
            "equivalent":   ref["azure_equiv"],
            "specs":        ref.get("azure_specs", ""),
            "source":       "reference",
            "currency":     "USD",
            "region_note":  "Central India",
        },
        "gcp": {
            "price":        ref["gcp"],
            "equivalent":   ref["gcp_equiv"],
            "specs":        ref.get("gcp_specs", ""),
            "source":       "reference",
            "currency":     "USD",
            "pricing_url":  "https://cloud.google.com/compute/all-pricing",
            "region_note":  "asia-south1",
        },
    }


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
                "services": services,   # all services for drilldown
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


@router.get("/ec2/instances")
def get_ec2_instance_costs(
    month: Optional[str] = None,   # YYYY-MM, defaults to current month
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Per-EC2-instance cost breakdown using AWS Cost Explorer resource-level granularity.
    Falls back to real-time DB pricing when CE resource data is unavailable.
    """
    try:
        ce    = get_ce_client()
        today = datetime.today()

        if month:
            y, m   = int(month[:4]), int(month[5:7])
            start  = f"{y:04d}-{m:02d}-01"
            import calendar
            last_day = calendar.monthrange(y, m)[1]
            end    = f"{y:04d}-{m:02d}-{last_day:02d}"
            # Cap end at today if month is current
            if end > today.strftime("%Y-%m-%d"):
                end = today.strftime("%Y-%m-%d")
        else:
            start = today.replace(day=1).strftime("%Y-%m-%d")
            end   = today.strftime("%Y-%m-%d")

        if start == end:
            # nothing to query yet
            raise ValueError("No data — period start equals end")

        resp = ce.get_cost_and_usage_with_resources(
            TimePeriod={"Start": start, "End": end},
            Granularity="MONTHLY",
            Metrics=["UnblendedCost"],
            Filter={
                "Dimensions": {
                    "Key": "SERVICE",
                    "Values": ["Amazon Elastic Compute Cloud - Compute"],
                }
            },
            GroupBy=[{"Type": "DIMENSION", "Key": "RESOURCE_ID"}],
        )

        instances = []
        for period in resp["ResultsByTime"]:
            for g in period["Groups"]:
                resource_id = g["Keys"][0]
                amt = float(g["Metrics"]["UnblendedCost"]["Amount"])
                if amt < 0.0001:
                    continue
                # Try to match to a VM name from DB
                vm = db.query(VM).filter(VM.instance_id == resource_id).first()
                instances.append({
                    "instance_id": resource_id,
                    "name":        vm.name if vm else resource_id,
                    "instance_type": vm.instance_type if vm else "—",
                    "state":       vm.state if vm else "unknown",
                    "region":      vm.region if vm else "—",
                    "amount":      round(amt, 4),
                })

        instances.sort(key=lambda x: x["amount"], reverse=True)
        total = sum(i["amount"] for i in instances)
        return {
            "period":    f"{start} → {end}",
            "total":     round(total, 4),
            "instances": instances,
        }

    except Exception as ce_err:
        # CE resource-level might not be enabled — fall back to real-time DB data
        print(f"EC2 instance CE error (falling back to realtime): {ce_err}")
        pricing = {
            "t2.micro":0.0116,"t2.medium":0.0464,"t2.large":0.0928,
            "t3.micro":0.0104,"t3.small":0.0208,"t3.medium":0.0416,"t3.large":0.0832,
            "t3a.medium":0.0376,"t3a.large":0.0752,"m5.large":0.096,
        }
        vms = db.query(VM).all()
        instances = []
        for vm in vms:
            price = pricing.get(vm.instance_type, 0.0104)
            hours = (
                (datetime.utcnow() - vm.start_time).total_seconds() / 3600
                if vm.state == "running" and vm.start_time else 0
            )
            instances.append({
                "instance_id":   vm.instance_id or "—",
                "name":          vm.name,
                "instance_type": vm.instance_type or "—",
                "state":         vm.state,
                "region":        vm.region or "—",
                "amount":        round(hours * price, 4),
            })
        instances.sort(key=lambda x: x["amount"], reverse=True)
        total = sum(i["amount"] for i in instances)
        return {
            "period":    "realtime",
            "total":     round(total, 4),
            "instances": instances,
            "source":    "realtime",
        }