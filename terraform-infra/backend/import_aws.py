"""
AIonOS AWS Resource Importer
Scans your AWS account and imports all resources into the platform database.
"""
import boto3
from database import SessionLocal
from models.vm import VM
from models.request import Request
from models.user import User
from datetime import datetime

REGION = "ap-south-1"
ALL_REGIONS = [
    "ap-south-1", "ap-southeast-1", "ap-southeast-2",
    "ap-northeast-1", "us-east-1", "us-east-2",
    "us-west-2", "eu-west-1", "eu-central-1"
]

def get_admin_id(db):
    admin = db.query(User).filter(User.role == "admin").first()
    return admin.id if admin else 1

def import_ec2(db, admin_id, regions):
    print("\n=== Importing EC2 Instances ===")
    imported = 0
    skipped  = 0
    for region in regions:
        try:
            ec2  = boto3.client("ec2", region_name=region)
            resp = ec2.describe_instances()
            for r in resp["Reservations"]:
                for inst in r["Instances"]:
                    if inst["State"]["Name"] == "terminated":
                        continue
                    iid  = inst["InstanceId"]
                    name = next((t["Value"] for t in inst.get("Tags",[]) if t["Key"]=="Name"), iid)
                    existing = db.query(VM).filter(VM.instance_id == iid).first()
                    if existing:
                        print(f"  SKIP  {iid} ({name}) - already exists")
                        skipped += 1
                        continue
                    vm = VM(
                        owner_id       = admin_id,
                        owner_username = "admin",
                        name           = name,
                        instance_id    = iid,
                        instance_type  = inst["InstanceType"],
                        region         = region,
                        ami_id         = inst.get("ImageId",""),
                        state          = inst["State"]["Name"],
                        public_ip      = inst.get("PublicIpAddress"),
                    )
                    db.add(vm)
                    imported += 1
                    print(f"  IMPORT {iid} ({name}) [{inst['InstanceType']}] - {inst['State']['Name']} - {region}")
        except Exception as e:
            print(f"  ERROR in {region}: {e}")
    db.commit()
    print(f"\nEC2: {imported} imported, {skipped} skipped")
    return imported

def scan_s3(regions):
    print("\n=== Scanning S3 Buckets ===")
    try:
        s3  = boto3.client("s3")
        res = s3.list_buckets()
        buckets = res.get("Buckets", [])
        print(f"Found {len(buckets)} S3 buckets (stored in AWS, visible in Resources page)")
        for b in buckets:
            print(f"  {b['Name']} - {b['CreationDate'].strftime('%Y-%m-%d')}")
    except Exception as e:
        print(f"  ERROR: {e}")

def scan_rds(regions):
    print("\n=== Scanning RDS Instances ===")
    total = 0
    for region in regions:
        try:
            rds  = boto3.client("rds", region_name=region)
            resp = rds.describe_db_instances()
            for db_inst in resp["DBInstances"]:
                status = db_inst["DBInstanceStatus"]
                print(f"  {db_inst['DBInstanceIdentifier']} [{db_inst['DBInstanceClass']}] - {status} - {region}")
                total += 1
        except Exception as e:
            if "OptInRequired" not in str(e) and "AuthFailure" not in str(e):
                print(f"  ERROR in {region}: {e}")
    if total == 0:
        print("  No RDS instances found")
    return total

def scan_vpc(regions):
    print("\n=== Scanning VPCs ===")
    total = 0
    for region in regions:
        try:
            ec2  = boto3.client("ec2", region_name=region)
            resp = ec2.describe_vpcs()
            for vpc in resp["Vpcs"]:
                if vpc.get("IsDefault"):
                    continue
                name = next((t["Value"] for t in vpc.get("Tags",[]) if t["Key"]=="Name"), vpc["VpcId"])
                print(f"  {vpc['VpcId']} ({name}) - {vpc['CidrBlock']} - {region}")
                total += 1
        except Exception as e:
            if "OptInRequired" not in str(e):
                print(f"  ERROR in {region}: {e}")
    if total == 0:
        print("  No custom VPCs found")

def scan_lambda(regions):
    print("\n=== Scanning Lambda Functions ===")
    total = 0
    for region in regions:
        try:
            lm   = boto3.client("lambda", region_name=region)
            resp = lm.list_functions()
            for fn in resp["Functions"]:
                print(f"  {fn['FunctionName']} [{fn['Runtime']}] - {fn['CodeSize']//1024} KB - {region}")
                total += 1
        except Exception as e:
            if "OptInRequired" not in str(e):
                print(f"  ERROR in {region}: {e}")
    if total == 0:
        print("  No Lambda functions found")

def scan_elb(regions):
    print("\n=== Scanning Load Balancers ===")
    total = 0
    for region in regions:
        try:
            elb  = boto3.client("elbv2", region_name=region)
            resp = elb.describe_load_balancers()
            for lb in resp["LoadBalancers"]:
                print(f"  {lb['LoadBalancerName']} [{lb['Type']}] - {lb['State']['Code']} - {region}")
                total += 1
        except Exception as e:
            if "OptInRequired" not in str(e):
                print(f"  ERROR in {region}: {e}")
    if total == 0:
        print("  No load balancers found")

def main():
    print("=" * 60)
    print("AIonOS AWS Resource Importer")
    print("Account: ap-south-1 (primary region)")
    print("=" * 60)

    db       = SessionLocal()
    admin_id = get_admin_id(db)

    # Import EC2 into DB (so they show in Compute/Resources pages)
    ec2_count = import_ec2(db, admin_id, ALL_REGIONS)

    # Scan other resources (informational - shown via AWS API)
    scan_s3(ALL_REGIONS)
    scan_rds(ALL_REGIONS)
    scan_vpc(ALL_REGIONS)
    scan_lambda(ALL_REGIONS)
    scan_elb(ALL_REGIONS)

    db.close()

    print("\n" + "=" * 60)
    print(f"Import complete!")
    print(f"  EC2 instances imported to database: {ec2_count}")
    print(f"  S3 buckets visible via AWS API")
    print(f"  RDS/VPC/Lambda/ELB scanned above")
    print("\nRefresh the Resources page to see all imported EC2 instances.")
    print("=" * 60)

if __name__ == "__main__":
    main()
