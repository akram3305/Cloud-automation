from fastapi import APIRouter, Depends, HTTPException
import boto3
from models import User
from routers.auth import get_current_user

router = APIRouter(prefix="/infra", tags=["infra"])

REGIONS = ["ap-south-1", "us-east-1", "eu-west-1"]


def _get_tags(tag_list):
    """Convert AWS Tags list to {Key: Value} dict."""
    return {t["Key"]: t["Value"] for t in (tag_list or [])}


@router.get("/vpcs")
def list_vpcs(user: User = Depends(get_current_user)):
    vpcs = []
    for region in REGIONS:
        try:
            ec2  = boto3.client("ec2", region_name=region)
            resp = ec2.describe_vpcs()
            for v in resp["Vpcs"]:
                tags = _get_tags(v.get("Tags", []))
                name = tags.get("Name", v["VpcId"])
                vpcs.append({
                    "id":          v["VpcId"],
                    "name":        name,
                    "cidr":        v["CidrBlock"],
                    "region":      region,
                    "state":       "available",
                    "is_default":  v.get("IsDefault", False),
                    "tags":        tags,
                    "environment": tags.get("Environment", ""),
                    "project":     tags.get("Project", ""),
                    "owner":       tags.get("Owner", ""),
                })
        except Exception as e:
            print(f"VPC {region}: {e}")
    return vpcs


@router.get("/lambdas")
def list_lambdas(user: User = Depends(get_current_user)):
    fns = []
    for region in REGIONS:
        try:
            lm   = boto3.client("lambda", region_name=region)
            resp = lm.list_functions()
            for f in resp["Functions"]:
                tags = {}
                try:
                    tr = lm.list_tags(Resource=f["FunctionArn"])
                    tags = tr.get("Tags", {})
                except Exception:
                    pass
                fns.append({
                    "name":        f["FunctionName"],
                    "runtime":     f.get("Runtime", ""),
                    "size_kb":     f["CodeSize"] // 1024,
                    "region":      region,
                    "state":       "active",
                    "modified":    f["LastModified"],
                    "tags":        tags,
                    "environment": tags.get("Environment", ""),
                    "project":     tags.get("Project", ""),
                    "owner":       tags.get("Owner", ""),
                })
        except Exception as e:
            print(f"Lambda {region}: {e}")
    return fns


@router.get("/loadbalancers")
def list_lbs(user: User = Depends(get_current_user)):
    lbs = []
    for region in REGIONS:
        try:
            elb  = boto3.client("elbv2", region_name=region)
            resp = elb.describe_load_balancers()
            arns = [lb["LoadBalancerArn"] for lb in resp["LoadBalancers"]]
            tags_map = {}
            if arns:
                try:
                    tr = elb.describe_tags(ResourceArns=arns)
                    for td in tr.get("TagDescriptions", []):
                        tags_map[td["ResourceArn"]] = _get_tags(td.get("Tags", []))
                except Exception:
                    pass
            for lb in resp["LoadBalancers"]:
                tags = tags_map.get(lb["LoadBalancerArn"], {})
                lbs.append({
                    "name":        lb["LoadBalancerName"],
                    "type":        lb["Type"],
                    "state":       lb["State"]["Code"],
                    "region":      region,
                    "dns":         lb.get("DNSName", ""),
                    "tags":        tags,
                    "environment": tags.get("Environment", ""),
                    "project":     tags.get("Project", ""),
                    "owner":       tags.get("Owner", ""),
                })
        except Exception as e:
            print(f"ELB {region}: {e}")
    return lbs


@router.get("/rds")
def list_rds(user: User = Depends(get_current_user)):
    instances = []
    for region in REGIONS:
        try:
            rds  = boto3.client("rds", region_name=region)
            resp = rds.describe_db_instances()
            for db in resp["DBInstances"]:
                tags = {}
                try:
                    tr = rds.list_tags_for_resource(ResourceName=db["DBInstanceArn"])
                    tags = _get_tags(tr.get("TagList", []))
                except Exception:
                    pass
                instances.append({
                    "id":          db["DBInstanceIdentifier"],
                    "engine":      db["Engine"] + " " + db.get("EngineVersion", ""),
                    "class":       db["DBInstanceClass"],
                    "status":      db["DBInstanceStatus"],
                    "region":      region,
                    "endpoint":    db.get("Endpoint", {}).get("Address", ""),
                    "tags":        tags,
                    "environment": tags.get("Environment", ""),
                    "project":     tags.get("Project", ""),
                    "owner":       tags.get("Owner", ""),
                })
        except Exception as e:
            print(f"RDS {region}: {e}")
    return instances
