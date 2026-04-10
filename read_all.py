import os

base = r"D:\AWS_Terraform_automation\terraform-infra"

files_to_read = [
    r"modules\vpc\variables.tf",
    r"modules\vpc\outputs.tf", 
    r"modules\vpc\main.tf",
    r"modules\security_group\variables.tf",
    r"modules\security_group\outputs.tf",
    r"modules\security_group\main.tf",
    r"modules\S3\variables.tf",
    r"modules\S3\outputs.tf",
    r"modules\keypair\variables.tf",
    r"modules\keypair\outputs.tf",
    r"modules\keypair\main.tf",
    r"modules\database\variables.tf",
    r"modules\database\outputs.tf",
    r"environments\dev\terraform.tfvars",
    r"environments\dev\provider.tf",
]

for f in files_to_read:
    full = os.path.join(base, f)
    print(f"\n{'='*60}")
    print(f"FILE: {f}")
    print('='*60)
    try:
        with open(full, 'r', encoding='utf-8') as fh:
            print(fh.read())
    except Exception as e:
        print(f"ERROR: {e}")
