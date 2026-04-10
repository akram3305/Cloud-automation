import os

base = r"D:\AWS_Terraform_automation\terraform-infra"

files = [
    r"modules\compute\ec2\main.tf",
    r"modules\compute\ec2\variables.tf", 
    r"modules\compute\ec2\outputs.tf",
    r"modules\vpc\main.tf",
    r"modules\vpc\variables.tf",
    r"modules\vpc\outputs.tf",
    r"modules\security_group\main.tf",
    r"modules\security_group\variables.tf",
    r"modules\security_group\outputs.tf",
    r"modules\S3\main.tf",
    r"modules\S3\variables.tf",
    r"modules\S3\outputs.tf",
    r"modules\keypair\main.tf",
    r"modules\keypair\variables.tf",
    r"modules\keypair\outputs.tf",
    r"environments\dev\main.tf",
    r"environments\dev\variables.tf",
    r"environments\dev\terraform.tfvars",
    r"environments\dev\backend.tf",
    r"environments\dev\provider.tf",
]

for f in files:
    full = os.path.join(base, f)
    print(f"\n{'='*60}")
    print(f"FILE: {f}")
    print('='*60)
    try:
        with open(full, 'r', encoding='utf-8') as fh:
            content = fh.read()
            print(content if content.strip() else "(EMPTY)")
    except Exception as e:
        print(f"ERROR: {e}")
