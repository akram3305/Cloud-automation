"""Sync ALL EC2 instances (insert + update)"""

import boto3
from database import SessionLocal
from models.vm import VM
from models import User
from datetime import datetime

db = SessionLocal()

# 🔥 Get default system user (IMPORTANT)
system_user = db.query(User).filter(User.username == "system").first()
SYSTEM_USER_ID = system_user.id if system_user else 1

ec2 = boto3.client("ec2", region_name="ap-south-1")

response = ec2.describe_instances()

aws_instances = {}

# 🔥 Collect AWS instances
for r in response["Reservations"]:
    for inst in r["Instances"]:
        aws_instances[inst["InstanceId"]] = {
            "name": next((t["Value"] for t in inst.get("Tags", []) if t["Key"] == "Name"), "unknown"),
            "instance_type": inst["InstanceType"],
            "state": inst["State"]["Name"],
            "public_ip": inst.get("PublicIpAddress"),
            "private_ip": inst.get("PrivateIpAddress"),
            "ami_id": inst.get("ImageId"),
            "region": "ap-south-1",
        }

# 🔥 Get DB instances
db_vms = db.query(VM).all()
db_map = {vm.instance_id: vm for vm in db_vms}

updated = 0
created = 0

# 🔥 UPDATE + INSERT
for instance_id, data in aws_instances.items():

    if instance_id in db_map:
        vm = db_map[instance_id]

        # UPDATE
        if vm.state != data["state"] or vm.public_ip != data["public_ip"]:
            print(f"Updating {vm.name}: {vm.state} -> {data['state']}")
            vm.state = data["state"]
            vm.public_ip = data["public_ip"]

            # 🔥 handle start_time
            if data["state"] == "running" and not vm.start_time:
                vm.start_time = datetime.utcnow()
            elif data["state"] != "running":
                vm.start_time = None

            updated += 1

    else:
        # 🔥 INSERT NEW VM
        print(f"Creating new VM: {data['name']}")

        vm = VM(
            name=data["name"],
            instance_id=instance_id,
            instance_type=data["instance_type"],
            region=data["region"],
            ami_id=data["ami_id"],
            state=data["state"],
            public_ip=data["public_ip"],
            private_ip=data["private_ip"],
            owner_username="aws-console",

            # 🔥 FIX: required field
            owner_id=SYSTEM_USER_ID,

            # 🔥 start time logic
            start_time=datetime.utcnow() if data["state"] == "running" else None
        )

        db.add(vm)
        created += 1

db.commit()
db.close()

print(f"\n✅ Updated: {updated}")
print(f"✅ Created: {created}")