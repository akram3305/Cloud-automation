from fastapi import APIRouter, Depends, HTTPException
import boto3
from models import User
from routers.auth import get_current_user

router = APIRouter(prefix="/infra", tags=["infra"])

REGIONS = ["ap-south-1", "us-east-1", "eu-west-1"]

@router.get("/vpcs")
def list_vpcs(user: User = Depends(get_current_user)):
    vpcs = []
    for region in REGIONS:
        try:
            ec2  = boto3.client("ec2", region_name=region)
            resp = ec2.describe_vpcs()
            for v in resp["Vpcs"]:
                if v.get("IsDefault"): continue
                name = next((t["Value"] for t in v.get("Tags",[]) if t["Key"]=="Name"), v["VpcId"])
                vpcs.append({"id":v["VpcId"],"name":name,"cidr":v["CidrBlock"],"region":region,"state":"available"})
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
                fns.append({"name":f["FunctionName"],"runtime":f.get("Runtime",""),"size_kb":f["CodeSize"]//1024,"region":region,"state":"active","modified":f["LastModified"]})
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
            for lb in resp["LoadBalancers"]:
                lbs.append({"name":lb["LoadBalancerName"],"type":lb["Type"],"state":lb["State"]["Code"],"region":region,"dns":lb.get("DNSName","")})
        except Exception as e:
            print(f"ELB {region}: {e}")
    return lbs
