"""
AWS EC2 compute automation via boto3.
All functions return simple dicts — no AWS types leak out.
"""
import boto3
from botocore.exceptions import ClientError
import config


def _ec2(region: str):
    """Return a boto3 EC2 client for the given region."""
    kwargs = {"region_name": region}
    if config.AWS_PROFILE:
        session = boto3.Session(profile_name=config.AWS_PROFILE)
        return session.client("ec2", **kwargs)
    return boto3.client("ec2", **kwargs)


def get_instance_state(instance_id: str, region: str = config.AWS_REGION) -> str | None:
    """
    Returns the current AWS state string:
    pending | running | shutting-down | terminated | stopping | stopped
    Returns None if the instance is not found.
    """
    try:
        resp = _ec2(region).describe_instances(InstanceIds=[instance_id])
        reservations = resp.get("Reservations", [])
        if reservations:
            state = reservations[0]["Instances"][0]["State"]["Name"]
            return state
        return None
    except ClientError as e:
        if e.response["Error"]["Code"] == "InvalidInstanceID.NotFound":
            return None
        raise


def start_instance(instance_id: str, region: str = config.AWS_REGION) -> dict:
    """
    Start a stopped EC2 instance.
    Returns {"state": "pending", "public_ip": "..." or None}
    """
    ec2 = _ec2(region)
    ec2.start_instances(InstanceIds=[instance_id])

    # Describe to get current state + IP (may still be pending)
    resp  = ec2.describe_instances(InstanceIds=[instance_id])
    inst  = resp["Reservations"][0]["Instances"][0]
    return {
        "state":     inst["State"]["Name"],
        "public_ip": inst.get("PublicIpAddress"),
    }


def stop_instance(instance_id: str, region: str = config.AWS_REGION) -> dict:
    """
    Stop a running EC2 instance.
    Returns {"state": "stopping"}
    """
    _ec2(region).stop_instances(InstanceIds=[instance_id])
    return {"state": "stopping"}


def list_instances(region: str = config.AWS_REGION) -> list[dict]:
    """
    List all non-terminated instances in the region.
    Returns a list of simplified dicts.
    """
    ec2  = _ec2(region)
    resp = ec2.describe_instances(Filters=[
        {"Name": "instance-state-name", "Values": ["pending","running","stopped","stopping"]}
    ])
    instances = []
    for r in resp.get("Reservations", []):
        for i in r["Instances"]:
            name = next(
                (t["Value"] for t in i.get("Tags", []) if t["Key"] == "Name"),
                i["InstanceId"]
            )
            instances.append({
                "instance_id":   i["InstanceId"],
                "name":          name,
                "instance_type": i["InstanceType"],
                "state":         i["State"]["Name"],
                "public_ip":     i.get("PublicIpAddress"),
                "private_ip":    i.get("PrivateIpAddress"),
                "region":        region,
            })
    return instances
