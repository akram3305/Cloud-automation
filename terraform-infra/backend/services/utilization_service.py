# -*- coding: utf-8 -*-
"""
services/utilization_service.py — AIonOS Platform
Fetches 24-hour average CPU utilization from AWS CloudWatch, GCP Cloud Monitoring, Azure Monitor.
"""
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Optional

IDLE_THRESHOLD      = 5.0    # % avg CPU — classified as "idle"
UNDERUTIL_THRESHOLD = 15.0   # % avg CPU — classified as "underutilized"


def _classify(state: str, avg_cpu: Optional[float]) -> str:
    if state not in ("running",):
        return "stopped"
    if avg_cpu is None:
        return "unknown"
    if avg_cpu < IDLE_THRESHOLD:
        return "idle"
    if avg_cpu < UNDERUTIL_THRESHOLD:
        return "underutilized"
    return "active"


# ── AWS ───────────────────────────────────────────────────────────────────────

def get_aws_utilization(regions: List[str] = None) -> List[Dict]:
    """Fetch EC2 CPU utilization via CloudWatch (24 h window)."""
    import boto3
    regions = regions or ["ap-south-1"]
    results = []

    end   = datetime.utcnow()
    start = end - timedelta(hours=24)

    for region in regions:
        try:
            ec2 = boto3.client("ec2", region_name=region)
            cw  = boto3.client("cloudwatch", region_name=region)

            resp = ec2.describe_instances(
                Filters=[{"Name": "instance-state-name", "Values": ["running", "stopped"]}]
            )

            for reservation in resp.get("Reservations", []):
                for inst in reservation.get("Instances", []):
                    iid   = inst["InstanceId"]
                    tags  = {t["Key"]: t["Value"] for t in inst.get("Tags", [])}
                    name  = tags.get("Name", iid)
                    owner = tags.get("Owner") or tags.get("CreatedBy") or ""
                    state = inst["State"]["Name"]

                    avg_cpu = max_cpu = None
                    if state == "running":
                        try:
                            cw_resp = cw.get_metric_statistics(
                                Namespace  = "AWS/EC2",
                                MetricName = "CPUUtilization",
                                Dimensions = [{"Name": "InstanceId", "Value": iid}],
                                StartTime  = start,
                                EndTime    = end,
                                Period     = 86400,
                                Statistics = ["Average", "Maximum"],
                            )
                            pts = sorted(cw_resp.get("Datapoints", []), key=lambda x: x["Timestamp"])
                            if pts:
                                avg_cpu = round(pts[-1]["Average"], 2)
                                max_cpu = round(pts[-1]["Maximum"], 2)
                        except Exception:
                            pass

                    results.append({
                        "cloud":         "aws",
                        "vm_id":         iid,
                        "vm_name":       name,
                        "region":        region,
                        "state":         state,
                        "instance_type": inst.get("InstanceType", ""),
                        "owner_email":   owner,
                        "avg_cpu_24h":   avg_cpu,
                        "max_cpu_24h":   max_cpu,
                        "status":        _classify(state, avg_cpu),
                    })
        except Exception as e:
            print(f"[Utilization] AWS error [{region}]: {e}")

    return results


# ── GCP ───────────────────────────────────────────────────────────────────────

def get_gcp_utilization() -> List[Dict]:
    """Fetch GCP Compute Engine CPU via Cloud Monitoring."""
    try:
        from services.gcp_client import CONFIGURED, GCP_PROJECT_ID, get_compute_client, _get_credentials, _no_verify_http
        if not CONFIGURED:
            return []
        from googleapiclient import discovery as _disc

        creds    = _get_credentials()
        compute  = get_compute_client()
        monitor  = _disc.build("monitoring", "v3", http=_no_verify_http(creds), cache_discovery=False)

        end   = datetime.now(timezone.utc)
        start = end - timedelta(hours=24)
        end_s   = end.strftime("%Y-%m-%dT%H:%M:%SZ")
        start_s = start.strftime("%Y-%m-%dT%H:%M:%SZ")

        # Aggregate all instances across all zones
        instances: list = []
        try:
            agg = compute.instances().aggregatedList(project=GCP_PROJECT_ID).execute()
            for zone_data in agg.get("items", {}).values():
                for inst in zone_data.get("instances", []):
                    instances.append(inst)
        except Exception as e:
            print(f"[Utilization] GCP list instances error: {e}")
            return []

        results = []
        for inst in instances:
            name   = inst["name"]
            zone   = inst.get("zone", "").split("/")[-1]
            status = inst.get("status", "")
            labels = inst.get("labels", {}) or {}
            owner  = labels.get("owner", "") or labels.get("created-by", "")
            mtype  = inst.get("machineType", "").split("/")[-1]

            state_map = {
                "RUNNING": "running", "STOPPED": "stopped",
                "TERMINATED": "stopped", "STAGING": "pending",
                "STOPPING": "stopping", "SUSPENDED": "stopped",
            }
            state = state_map.get(status, status.lower())

            avg_cpu = max_cpu = None
            if state == "running":
                try:
                    ts_resp = monitor.projects().timeSeries().list(
                        name=f"projects/{GCP_PROJECT_ID}",
                        filter=(
                            'metric.type="compute.googleapis.com/instance/cpu/utilization"'
                            f' AND resource.label.instance_id="{inst.get("id", "")}"'
                        ),
                        **{
                            "interval.startTime": start_s,
                            "interval.endTime":   end_s,
                            "aggregation.alignmentPeriod": "86400s",
                            "aggregation.perSeriesAligner": "ALIGN_MEAN",
                        }
                    ).execute()
                    series = ts_resp.get("timeSeries", [])
                    if series and series[0].get("points"):
                        val = series[0]["points"][0]["value"].get("doubleValue")
                        if val is not None:
                            avg_cpu = round(val * 100, 2)
                            max_cpu = avg_cpu
                except Exception:
                    pass

            results.append({
                "cloud":         "gcp",
                "vm_id":         str(inst.get("id", name)),
                "vm_name":       name,
                "region":        zone,
                "state":         state,
                "instance_type": mtype,
                "owner_email":   owner,
                "avg_cpu_24h":   avg_cpu,
                "max_cpu_24h":   max_cpu,
                "status":        _classify(state, avg_cpu),
            })
        return results
    except Exception as e:
        print(f"[Utilization] GCP error: {e}")
        return []


# ── Azure ─────────────────────────────────────────────────────────────────────

def get_azure_utilization(subscriptions: List[str] = None) -> List[Dict]:
    """Fetch Azure VM CPU utilization via Azure Monitor."""
    try:
        from services.azure_client import get_compute_client, _get_credential, _get_subscription_id
        from azure.mgmt.monitor import MonitorManagementClient
    except Exception as e:
        print(f"[Utilization] Azure import error: {e}")
        return []

    subscriptions = subscriptions or ["nonprod", "prod"]
    results = []

    end   = datetime.now(timezone.utc)
    start = end - timedelta(hours=24)
    timespan = f"{start.strftime('%Y-%m-%dT%H:%M:%SZ')}/{end.strftime('%Y-%m-%dT%H:%M:%SZ')}"

    for sub_key in subscriptions:
        try:
            compute  = get_compute_client(sub_key)
            cred     = _get_credential(sub_key)
            sub_id   = _get_subscription_id(sub_key)
            monitor  = MonitorManagementClient(cred, sub_id)

            for vm in list(compute.virtual_machines.list_all()):
                rg   = vm.id.split("/resourceGroups/")[1].split("/")[0]
                tags = vm.tags or {}
                owner = tags.get("Owner") or tags.get("owner") or ""

                try:
                    iv     = compute.virtual_machines.get(rg, vm.name, expand="instanceView")
                    pstate = "unknown"
                    for s in (iv.instance_view.statuses or []):
                        if s.code and s.code.startswith("PowerState/"):
                            pstate = s.code.split("/")[1]
                            break
                except Exception:
                    pstate = "unknown"

                state_map = {
                    "running": "running", "deallocated": "stopped",
                    "deallocating": "stopping", "starting": "pending",
                }
                state = state_map.get(pstate, pstate)

                avg_cpu = max_cpu = None
                if state == "running":
                    try:
                        metrics = monitor.metrics.list(
                            vm.id,
                            timespan=timespan,
                            interval="PT24H",
                            metricnames="Percentage CPU",
                            aggregation="Average,Maximum",
                        )
                        for metric in metrics.value:
                            for ts in metric.timeseries:
                                for dp in ts.data:
                                    if dp.average is not None:
                                        avg_cpu = round(dp.average, 2)
                                    if dp.maximum is not None:
                                        max_cpu = round(dp.maximum, 2)
                    except Exception:
                        pass

                results.append({
                    "cloud":         "azure",
                    "vm_id":         vm.id,
                    "vm_name":       vm.name,
                    "region":        vm.location or "",
                    "state":         state,
                    "instance_type": vm.hardware_profile.vm_size if vm.hardware_profile else "",
                    "owner_email":   owner,
                    "avg_cpu_24h":   avg_cpu,
                    "max_cpu_24h":   max_cpu,
                    "status":        _classify(state, avg_cpu),
                })
        except Exception as e:
            print(f"[Utilization] Azure error [{sub_key}]: {e}")

    return results
