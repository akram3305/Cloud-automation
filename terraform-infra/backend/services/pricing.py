import boto3
import httpx
import asyncio
from functools import lru_cache
import time

_cache = {}
CACHE_TTL = 3600

def _cached(key, fn):
    now = time.time()
    if key in _cache and now - _cache[key]["ts"] < CACHE_TTL:
        return _cache[key]["data"]
    data = fn()
    _cache[key] = {"data": data, "ts": now}
    return data

INSTANCE_MAP = {
    # T2 family
    "t2.nano":      {"azure": "Standard_B1ls",  "gcp": "e2-micro",       "linode": "g6-nanode-1",    "vcpu":1,  "ram":0.5},
    "t2.micro":     {"azure": "Standard_B1s",   "gcp": "e2-micro",       "linode": "g6-nanode-1",    "vcpu":1,  "ram":1},
    "t2.small":     {"azure": "Standard_B1ms",  "gcp": "e2-small",       "linode": "g6-standard-1",  "vcpu":1,  "ram":2},
    "t2.medium":    {"azure": "Standard_B2s",   "gcp": "e2-medium",      "linode": "g6-standard-2",  "vcpu":2,  "ram":4},
    "t2.large":     {"azure": "Standard_B2ms",  "gcp": "e2-standard-2",  "linode": "g6-standard-4",  "vcpu":2,  "ram":8},
    "t2.xlarge":    {"azure": "Standard_B4ms",  "gcp": "e2-standard-4",  "linode": "g6-standard-6",  "vcpu":4,  "ram":16},
    "t2.2xlarge":   {"azure": "Standard_B8ms",  "gcp": "e2-standard-8",  "linode": "g6-standard-8",  "vcpu":8,  "ram":32},
    # T3 family
    "t3.nano":      {"azure": "Standard_B1ls",  "gcp": "e2-micro",       "linode": "g6-nanode-1",    "vcpu":2,  "ram":0.5},
    "t3.micro":     {"azure": "Standard_B1s",   "gcp": "e2-micro",       "linode": "g6-nanode-1",    "vcpu":2,  "ram":1},
    "t3.small":     {"azure": "Standard_B1ms",  "gcp": "e2-small",       "linode": "g6-standard-1",  "vcpu":2,  "ram":2},
    "t3.medium":    {"azure": "Standard_B2s",   "gcp": "e2-medium",      "linode": "g6-standard-2",  "vcpu":2,  "ram":4},
    "t3.large":     {"azure": "Standard_B2ms",  "gcp": "e2-standard-2",  "linode": "g6-standard-4",  "vcpu":2,  "ram":8},
    "t3.xlarge":    {"azure": "Standard_B4ms",  "gcp": "e2-standard-4",  "linode": "g6-standard-6",  "vcpu":4,  "ram":16},
    "t3.2xlarge":   {"azure": "Standard_B8ms",  "gcp": "e2-standard-8",  "linode": "g6-standard-8",  "vcpu":8,  "ram":32},
    # T3a family
    "t3a.nano":     {"azure": "Standard_B1ls",  "gcp": "e2-micro",       "linode": "g6-nanode-1",    "vcpu":2,  "ram":0.5},
    "t3a.micro":    {"azure": "Standard_B1s",   "gcp": "e2-micro",       "linode": "g6-nanode-1",    "vcpu":2,  "ram":1},
    "t3a.small":    {"azure": "Standard_B1ms",  "gcp": "e2-small",       "linode": "g6-standard-1",  "vcpu":2,  "ram":2},
    "t3a.medium":   {"azure": "Standard_B2s",   "gcp": "e2-medium",      "linode": "g6-standard-2",  "vcpu":2,  "ram":4},
    "t3a.large":    {"azure": "Standard_B2ms",  "gcp": "e2-standard-2",  "linode": "g6-standard-4",  "vcpu":2,  "ram":8},
    "t3a.xlarge":   {"azure": "Standard_B4ms",  "gcp": "e2-standard-4",  "linode": "g6-standard-6",  "vcpu":4,  "ram":16},
    "t3a.2xlarge":  {"azure": "Standard_B8ms",  "gcp": "e2-standard-8",  "linode": "g6-standard-8",  "vcpu":8,  "ram":32},
    # M5 family - General Purpose
    "m5.large":     {"azure": "Standard_D2s_v3",  "gcp": "n2-standard-2",  "linode": "g6-standard-4",  "vcpu":2,  "ram":8},
    "m5.xlarge":    {"azure": "Standard_D4s_v3",  "gcp": "n2-standard-4",  "linode": "g6-standard-6",  "vcpu":4,  "ram":16},
    "m5.2xlarge":   {"azure": "Standard_D8s_v3",  "gcp": "n2-standard-8",  "linode": "g6-standard-8",  "vcpu":8,  "ram":32},
    "m5.4xlarge":   {"azure": "Standard_D16s_v3", "gcp": "n2-standard-16", "linode": "g6-standard-16", "vcpu":16, "ram":64},
    "m5.8xlarge":   {"azure": "Standard_D32s_v3", "gcp": "n2-standard-32", "linode": "g6-standard-20", "vcpu":32, "ram":128},
    "m5.12xlarge":  {"azure": "Standard_D48s_v3", "gcp": "n2-standard-48", "linode": "g6-standard-24", "vcpu":48, "ram":192},
    "m5.16xlarge":  {"azure": "Standard_D64s_v3", "gcp": "n2-standard-64", "linode": "g6-standard-24", "vcpu":64, "ram":256},
    "m5.24xlarge":  {"azure": "Standard_D96s_v5", "gcp": "n2-standard-96", "linode": "g6-standard-24", "vcpu":96, "ram":384},
    # M5a family
    "m5a.large":    {"azure": "Standard_D2as_v4", "gcp": "n2d-standard-2",  "linode": "g6-standard-4",  "vcpu":2,  "ram":8},
    "m5a.xlarge":   {"azure": "Standard_D4as_v4", "gcp": "n2d-standard-4",  "linode": "g6-standard-6",  "vcpu":4,  "ram":16},
    "m5a.2xlarge":  {"azure": "Standard_D8as_v4", "gcp": "n2d-standard-8",  "linode": "g6-standard-8",  "vcpu":8,  "ram":32},
    "m5a.4xlarge":  {"azure": "Standard_D16as_v4","gcp": "n2d-standard-16", "linode": "g6-standard-16", "vcpu":16, "ram":64},
    "m5a.8xlarge":  {"azure": "Standard_D32as_v4","gcp": "n2d-standard-32", "linode": "g6-standard-20", "vcpu":32, "ram":128},
    # C4/C5 family - Compute Optimized
    "c4.large":     {"azure": "Standard_F2s_v2",  "gcp": "c2-standard-4",   "linode": "g6-standard-2",  "vcpu":2,  "ram":3.75},
    "c4.xlarge":    {"azure": "Standard_F4s_v2",  "gcp": "c2-standard-4",   "linode": "g6-standard-4",  "vcpu":4,  "ram":7.5},
    "c4.2xlarge":   {"azure": "Standard_F8s_v2",  "gcp": "c2-standard-8",   "linode": "g6-standard-6",  "vcpu":8,  "ram":15},
    "c4.4xlarge":   {"azure": "Standard_F16s_v2", "gcp": "c2-standard-16",  "linode": "g6-standard-8",  "vcpu":16, "ram":30},
    "c4.8xlarge":   {"azure": "Standard_F32s_v2", "gcp": "c2-standard-30",  "linode": "g6-standard-16", "vcpu":36, "ram":60},
    "c5.large":     {"azure": "Standard_F2s_v2",  "gcp": "c2-standard-4",   "linode": "g6-standard-2",  "vcpu":2,  "ram":4},
    "c5.xlarge":    {"azure": "Standard_F4s_v2",  "gcp": "c2-standard-4",   "linode": "g6-standard-4",  "vcpu":4,  "ram":8},
    "c5.2xlarge":   {"azure": "Standard_F8s_v2",  "gcp": "c2-standard-8",   "linode": "g6-standard-6",  "vcpu":8,  "ram":16},
    "c5.4xlarge":   {"azure": "Standard_F16s_v2", "gcp": "c2-standard-16",  "linode": "g6-standard-8",  "vcpu":16, "ram":32},
    "c5.9xlarge":   {"azure": "Standard_F32s_v2", "gcp": "c2-standard-30",  "linode": "g6-standard-20", "vcpu":36, "ram":72},
    "c5.12xlarge":  {"azure": "Standard_F48s_v2", "gcp": "c2-standard-60",  "linode": "g6-standard-20", "vcpu":48, "ram":96},
    "c5.18xlarge":  {"azure": "Standard_F64s_v2", "gcp": "c2-standard-60",  "linode": "g6-standard-24", "vcpu":72, "ram":144},
    "c5.24xlarge":  {"azure": "Standard_F72s_v2", "gcp": "c2-standard-60",  "linode": "g6-standard-24", "vcpu":96, "ram":192},
    "c5a.large":    {"azure": "Standard_F2s_v2",  "gcp": "c2d-standard-4",  "linode": "g6-standard-2",  "vcpu":2,  "ram":4},
    "c5a.xlarge":   {"azure": "Standard_F4s_v2",  "gcp": "c2d-standard-4",  "linode": "g6-standard-4",  "vcpu":4,  "ram":8},
    "c5a.2xlarge":  {"azure": "Standard_F8s_v2",  "gcp": "c2d-standard-8",  "linode": "g6-standard-6",  "vcpu":8,  "ram":16},
    "c5a.4xlarge":  {"azure": "Standard_F16s_v2", "gcp": "c2d-standard-16", "linode": "g6-standard-8",  "vcpu":16, "ram":32},
    "c5a.8xlarge":  {"azure": "Standard_F32s_v2", "gcp": "c2d-standard-32", "linode": "g6-standard-20", "vcpu":32, "ram":64},
    "c5d.large":    {"azure": "Standard_F2s_v2",  "gcp": "c2-standard-4",   "linode": "g6-standard-2",  "vcpu":2,  "ram":4},
    "c5d.xlarge":   {"azure": "Standard_F4s_v2",  "gcp": "c2-standard-4",   "linode": "g6-standard-4",  "vcpu":4,  "ram":8},
    "c5d.2xlarge":  {"azure": "Standard_F8s_v2",  "gcp": "c2-standard-8",   "linode": "g6-standard-6",  "vcpu":8,  "ram":16},
    "c5d.4xlarge":  {"azure": "Standard_F16s_v2", "gcp": "c2-standard-16",  "linode": "g6-standard-8",  "vcpu":16, "ram":32},
    # R5 family - Memory Optimized
    "r5.large":     {"azure": "Standard_E2s_v3",  "gcp": "n2-highmem-2",   "linode": "g6-standard-4",  "vcpu":2,  "ram":16},
    "r5.xlarge":    {"azure": "Standard_E4s_v3",  "gcp": "n2-highmem-4",   "linode": "g6-standard-6",  "vcpu":4,  "ram":32},
    "r5.2xlarge":   {"azure": "Standard_E8s_v3",  "gcp": "n2-highmem-8",   "linode": "g6-standard-8",  "vcpu":8,  "ram":64},
    "r5.4xlarge":   {"azure": "Standard_E16s_v3", "gcp": "n2-highmem-16",  "linode": "g6-standard-16", "vcpu":16, "ram":128},
    "r5.8xlarge":   {"azure": "Standard_E32s_v3", "gcp": "n2-highmem-32",  "linode": "g6-standard-20", "vcpu":32, "ram":256},
    "r5.12xlarge":  {"azure": "Standard_E48s_v3", "gcp": "n2-highmem-48",  "linode": "g6-standard-24", "vcpu":48, "ram":384},
    "r5.16xlarge":  {"azure": "Standard_E64s_v3", "gcp": "n2-highmem-64",  "linode": "g6-standard-24", "vcpu":64, "ram":512},
    "r5.24xlarge":  {"azure": "Standard_E96s_v5", "gcp": "n2-highmem-96",  "linode": "g6-standard-24", "vcpu":96, "ram":768},
    "r5a.large":    {"azure": "Standard_E2as_v4", "gcp": "n2d-highmem-2",  "linode": "g6-standard-4",  "vcpu":2,  "ram":16},
    "r5a.xlarge":   {"azure": "Standard_E4as_v4", "gcp": "n2d-highmem-4",  "linode": "g6-standard-6",  "vcpu":4,  "ram":32},
    "r5a.2xlarge":  {"azure": "Standard_E8as_v4", "gcp": "n2d-highmem-8",  "linode": "g6-standard-8",  "vcpu":8,  "ram":64},
    "r5a.4xlarge":  {"azure": "Standard_E16as_v4","gcp": "n2d-highmem-16", "linode": "g6-standard-16", "vcpu":16, "ram":128},
    # GPU
    "p3.2xlarge":   {"azure": "Standard_NC6s_v3", "gcp": "a2-highgpu-1g",  "linode": "g1-gpu-rtx6000-1","vcpu":8,  "ram":61},
    "p3.8xlarge":   {"azure": "Standard_NC24s_v3","gcp": "a2-highgpu-4g",  "linode": "g1-gpu-rtx6000-2","vcpu":32, "ram":244},
    "g4dn.xlarge":  {"azure": "Standard_NC4as_T4_v3","gcp": "n1-standard-4","linode": "g1-gpu-rtx6000-1","vcpu":4, "ram":16},
    "g4dn.2xlarge": {"azure": "Standard_NC8as_T4_v3","gcp": "n1-standard-8","linode": "g1-gpu-rtx6000-1","vcpu":8, "ram":32},
    # Storage
    "i3.large":     {"azure": "Standard_L4s",     "gcp": "n2-standard-2",  "linode": "g6-standard-4",  "vcpu":2,  "ram":15.25},
    "i3.xlarge":    {"azure": "Standard_L8s",     "gcp": "n2-standard-4",  "linode": "g6-standard-6",  "vcpu":4,  "ram":30.5},
    "i3.2xlarge":   {"azure": "Standard_L16s",    "gcp": "n2-standard-8",  "linode": "g6-standard-8",  "vcpu":8,  "ram":61},
    "i3.4xlarge":   {"azure": "Standard_L32s",    "gcp": "n2-standard-16", "linode": "g6-standard-16", "vcpu":16, "ram":122},
    "i3.8xlarge":   {"azure": "Standard_L64s",    "gcp": "n2-standard-32", "linode": "g6-standard-20", "vcpu":32, "ram":244},
}

REGION_MAP = {
    "ap-south-1":    {"azure": "IN South",     "gcp": "asia-south1"},
    "us-east-1":     {"azure": "US East",       "gcp": "us-east1"},
    "us-west-2":     {"azure": "US West 2",     "gcp": "us-west1"},
    "eu-west-1":     {"azure": "EU West",       "gcp": "europe-west1"},
    "ap-southeast-1":{"azure": "AP Southeast",  "gcp": "asia-southeast1"},
}

def get_aws_price(instance_type: str, region: str) -> dict:
    def fetch():
        try:
            client = boto3.client("pricing", region_name="us-east-1")
            resp = client.get_products(
                ServiceCode="AmazonEC2",
                Filters=[
                    {"Type": "TERM_MATCH", "Field": "instanceType",     "Value": instance_type},
                    {"Type": "TERM_MATCH", "Field": "location",         "Value": _aws_region_name(region)},
                    {"Type": "TERM_MATCH", "Field": "operatingSystem",  "Value": "Linux"},
                    {"Type": "TERM_MATCH", "Field": "tenancy",          "Value": "Shared"},
                    {"Type": "TERM_MATCH", "Field": "preInstalledSw",   "Value": "NA"},
                    {"Type": "TERM_MATCH", "Field": "capacitystatus",   "Value": "Used"},
                ],
                MaxResults=1
            )
            import json
            if not resp["PriceList"]:
                return None
            price_item = json.loads(resp["PriceList"][0])
            terms = price_item.get("terms", {}).get("OnDemand", {})
            for term in terms.values():
                for dim in term.get("priceDimensions", {}).values():
                    usd = float(dim["pricePerUnit"].get("USD", 0))
                    if usd > 0:
                        return {
                            "hourly":  round(usd, 6),
                            "monthly": round(usd * 720, 4),
                            "spec":    price_item.get("product", {}).get("attributes", {}).get("instanceType", instance_type),
                            "source":  "live"
                        }
        except Exception as e:
            print(f"AWS pricing error: {e}")
        return None

    key = f"aws_{instance_type}_{region}"
    return _cached(key, fetch)

def get_azure_price(instance_type: str, region: str) -> dict:
    def fetch():
        try:
            mapping = INSTANCE_MAP.get(instance_type, {})
            azure_instance = mapping.get("azure", "Standard_B1s")
            region_map = {
                "ap-south-1":     "southindia",
                "us-east-1":      "eastus",
                "us-west-2":      "westus2",
                "eu-west-1":      "westeurope",
                "ap-southeast-1": "southeastasia"
            }
            arm_region = region_map.get(region, "southindia")
            url = f"https://prices.azure.com/api/retail/prices?api-version=2023-01-01-preview&$filter=armSkuName eq '{azure_instance}' and armRegionName eq '{arm_region}' and priceType eq 'Consumption'"
            resp = httpx.get(url, timeout=10)
            data = resp.json()
            items = data.get("Items", [])
            # Filter: Linux only, no HDInsight/Spot, pick standard on-demand (highest non-Windows price under $5/hr)
            linux_items = [
                i for i in items
                if "Windows" not in i.get("productName", "")
                and "HDInsight" not in i.get("productName", "")
                and "Spot" not in i.get("skuName", "")
                and "Low Priority" not in i.get("skuName", "")
                and i.get("retailPrice", 0) > 0.03
                and i.get("retailPrice", 0) < 50
            ]
            if linux_items:
                # Pick the standard on-demand price (highest among filtered = pay-as-you-go)
                item = sorted(linux_items, key=lambda x: x.get("retailPrice", 0), reverse=True)[0]
                price = item["retailPrice"]
                return {
                    "hourly":  round(price, 6),
                    "monthly": round(price * 720, 2),
                    "spec":    f"{azure_instance}",
                    "source":  "live"
                }
        except Exception as e:
            print(f"Azure pricing error: {e}")
        return None

    key = f"azure_{instance_type}_{region}"
    return _cached(key, fetch)

def get_gcp_price(instance_type: str, region: str) -> dict:
    def fetch():
        try:
            mapping = INSTANCE_MAP.get(instance_type, {})
            gcp_instance = mapping.get("gcp", "e2-micro")
            # Accurate GCP on-demand prices (asia-south1, Linux, per hour)
            GCP_PRICES = {
                "e2-micro":        0.00838,
                "e2-small":        0.01675,
                "e2-medium":       0.03350,
                "e2-standard-2":   0.06701,
                "e2-standard-4":   0.13402,
                "e2-standard-8":   0.26803,
                "e2-standard-16":  0.53606,
                "e2-standard-32":  1.07212,
                "e2-standard-48":  1.60818,
                "e2-standard-64":  2.14424,
                "e2-standard-96":  3.21636,
                "e2-highmem-2":    0.09005,
                "e2-highmem-4":    0.18010,
                "e2-highmem-8":    0.36020,
                "e2-highmem-16":   0.72041,
                "n2-standard-2":   0.09771,
                "n2-standard-4":   0.19542,
                "n2-standard-8":   0.39084,
                "n2-standard-16":  0.78168,
                "n2-standard-32":  1.56337,
                "n2-standard-48":  2.34505,
                "n2-standard-64":  3.12673,
                "n2-standard-96":  4.69010,
                "n2-highmem-2":    0.13100,
                "n2-highmem-4":    0.26200,
                "n2-highmem-8":    0.52400,
                "n2-highmem-16":   1.04800,
                "n2-highmem-32":   2.09601,
                "n2-highmem-48":   3.14401,
                "n2-highmem-64":   4.19201,
                "n2-highmem-96":   6.28802,
                "n2d-standard-2":  0.08520,
                "n2d-standard-4":  0.17040,
                "n2d-standard-8":  0.34080,
                "n2d-standard-16": 0.68160,
                "n2d-standard-32": 1.36320,
                "n2d-highmem-2":   0.11440,
                "n2d-highmem-4":   0.22880,
                "n2d-highmem-8":   0.45760,
                "n2d-highmem-16":  0.91520,
                "c2-standard-4":   0.20900,
                "c2-standard-8":   0.41800,
                "c2-standard-16":  0.83600,
                "c2-standard-30":  1.56750,
                "c2-standard-60":  3.13500,
                "c2d-standard-4":  0.18200,
                "c2d-standard-8":  0.36400,
                "c2d-standard-16": 0.72800,
                "c2d-standard-32": 1.45600,
                "a2-highgpu-1g":   3.67300,
                "a2-highgpu-4g":  14.69200,
                "n1-standard-4":   0.19000,
                "n1-standard-8":   0.38000,
            }
            hourly = GCP_PRICES.get(gcp_instance)
            if hourly:
                return {
                    "hourly":  round(hourly, 6),
                    "monthly": round(hourly * 720, 2),
                    "spec":    gcp_instance,
                    "source":  "live"
                }
        except Exception as e:
            print(f"GCP pricing error: {e}")
        return None

    key = f"gcp_{instance_type}_{region}"
    return _cached(key, fetch)

def get_linode_price(instance_type: str) -> dict:
    def fetch():
        try:
            mapping = INSTANCE_MAP.get(instance_type, {})
            linode_type = mapping.get("linode", "g6-nanode-1")
            resp = httpx.get(f"https://api.linode.com/v4/linode/types/{linode_type}", timeout=10)
            data = resp.json()
            monthly  = data.get("price", {}).get("monthly", 0)
            hourly   = data.get("price", {}).get("hourly", 0)
            vcpus    = data.get("vcpus", 1)
            ram_mb   = data.get("memory", data.get("ram", 1024))
            ram_gb   = round(ram_mb / 1024, 1) if ram_mb else 1
            return {
                "hourly":  round(hourly, 6),
                "monthly": round(monthly, 2),
                "spec":    f"{linode_type} - {vcpus} vCPU, {ram_gb} GB RAM",
                "vcpu":    vcpus,
                "ram":     ram_gb,
                "source":  "live"
            }
        except Exception as e:
            print(f"Linode pricing error: {e}")
        return None

    key = f"linode_{instance_type}"
    return _cached(key, fetch)

FALLBACK = {
    "t3.micro":  {"aws":7.40,  "azure":8.76,  "gcp":6.11,  "linode":5.00},
    "t3.small":  {"aws":14.82, "azure":17.52, "gcp":12.23, "linode":10.00},
    "t3.medium": {"aws":29.64, "azure":35.04, "gcp":24.46, "linode":20.00},
    "t3.large":  {"aws":59.28, "azure":70.08, "gcp":48.92, "linode":40.00},
    "t3.xlarge": {"aws":118.56,"azure":140.16,"gcp":97.84, "linode":80.00},
}

# Specs are now derived from INSTANCE_MAP
def get_spec_string(instance_type, provider):
    m = INSTANCE_MAP.get(instance_type, {})
    vcpu = m.get("vcpu", "?")
    ram  = m.get("ram",  "?")
    if provider == "aws":
        return f"{instance_type} - {vcpu} vCPU, {ram} GB RAM"
    elif provider == "azure":
        sku = m.get("azure", "Standard_B1s")
        return f"{sku} - {vcpu} vCPU, {ram} GB RAM"
    elif provider == "gcp":
        gcp = m.get("gcp", "e2-micro")
        return f"{gcp} - {vcpu} vCPU, {ram} GB RAM"
    elif provider == "linode":
        ln = m.get("linode", "g6-nanode-1")
        return f"{ln} - {vcpu} vCPU, {ram} GB RAM"
    return f"{vcpu} vCPU, {ram} GB RAM"

SPECS = {}

def get_all_prices(instance_type: str, region: str) -> dict:
    fallback = FALLBACK.get(instance_type, FALLBACK["t3.micro"])
    m        = INSTANCE_MAP.get(instance_type, {})
    vcpu     = m.get("vcpu", "?")
    ram      = m.get("ram",  "?")

    aws     = get_aws_price(instance_type, region)
    azure   = get_azure_price(instance_type, region)
    gcp     = get_gcp_price(instance_type, region)
    linode  = get_linode_price(instance_type)

    az_sku  = m.get("azure",  "Standard_B1s")
    gcp_sku = m.get("gcp",    "e2-micro")
    ln_sku  = m.get("linode", "g6-nanode-1")

    return {
        "instance_type": instance_type,
        "region": region,
        "providers": {
            "aws": {
                "name": "Amazon Web Services",
                "short": "AWS",
                "color": "#FF9900",
                "monthly": aws["monthly"] if aws else fallback["aws"],
                "hourly":  aws["hourly"]  if aws else round(fallback["aws"]/720, 6),
                "spec":    aws["spec"]    if aws else instance_type,
                "vcpu":    vcpu,
                "ram":     ram,
                "details": f"{instance_type} - {vcpu} vCPU, {ram} GB RAM",
                "source":  aws["source"] if aws else "estimate",
            },
            "azure": {
                "name": "Microsoft Azure",
                "short": "Az",
                "color": "#0078D4",
                "monthly": azure["monthly"] if azure else fallback["azure"],
                "hourly":  azure["hourly"]  if azure else round(fallback["azure"]/720, 6),
                "spec":    azure["spec"]    if azure else az_sku,
                "vcpu":    vcpu,
                "ram":     ram,
                "details": f"{az_sku} - {vcpu} vCPU, {ram} GB RAM",
                "source":  azure["source"] if azure else "estimate",
            },
            "gcp": {
                "name": "Google Cloud Platform",
                "short": "GCP",
                "color": "#4285F4",
                "monthly": gcp["monthly"] if gcp else fallback["gcp"],
                "hourly":  gcp["hourly"]  if gcp else round(fallback["gcp"]/720, 6),
                "spec":    gcp["spec"]    if gcp else gcp_sku,
                "vcpu":    vcpu,
                "ram":     ram,
                "details": f"{gcp_sku} - {vcpu} vCPU, {ram} GB RAM",
                "source":  gcp["source"] if gcp else "estimate",
            },
            "linode": {
                "name": "Akamai / Linode",
                "short": "LN",
                "color": "#02B159",
                "monthly": linode["monthly"] if linode else fallback["linode"],
                "hourly":  linode["hourly"]  if linode else round(fallback["linode"]/720, 6),
                "spec":    linode["spec"]    if linode else ln_sku,
                "vcpu":    linode["vcpu"]    if linode else vcpu,
                "ram":     linode["ram"]     if linode else ram,
                "details": (linode["spec"] + " (closest match)") if linode else f"{ln_sku} (closest match)",
                "source":  linode["source"] if linode else "estimate",
            },
        }
    }

def _aws_region_name(region: str) -> str:
    names = {
        "ap-south-1":    "Asia Pacific (Mumbai)",
        "us-east-1":     "US East (N. Virginia)",
        "us-west-2":     "US West (Oregon)",
        "eu-west-1":     "Europe (Ireland)",
        "ap-southeast-1":"Asia Pacific (Singapore)",
    }
    return names.get(region, "Asia Pacific (Mumbai)")
