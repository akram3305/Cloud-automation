# -*- coding: utf-8 -*-
"""
AIonOS Platform - Install all terraform files
Run from: D:\AWS_Terraform_automation\terraform-infra\backend\
"""
import os, shutil
from pathlib import Path

BASE = Path(r"D:\AWS_Terraform_automation\terraform-infra")

files = {
    # Dev environment
    r"environments\dev\provider.tf":        r"environments\dev\provider.tf",
    r"environments\dev\main.tf":            r"environments\dev\main.tf",
    r"environments\dev\variables.tf":       r"environments\dev\variables.tf",
    r"environments\dev\terraform.tfvars":   r"environments\dev\terraform.tfvars",

    # Staging environment
    r"environments\staging\provider.tf":    r"environments\staging\provider.tf",
    r"environments\staging\backend.tf":     r"environments\staging\backend.tf",
    r"environments\staging\main.tf":        r"environments\staging\main.tf",
    r"environments\staging\variables.tf":   r"environments\staging\variables.tf",
    r"environments\staging\terraform.tfvars": r"environments\staging\terraform.tfvars",

    # Prod environment
    r"environments\prod\provider.tf":       r"environments\prod\provider.tf",
    r"environments\prod\backend.tf":        r"environments\prod\backend.tf",
    r"environments\prod\main.tf":           r"environments\prod\main.tf",
    r"environments\prod\variables.tf":      r"environments\prod\variables.tf",
    r"environments\prod\terraform.tfvars":  r"environments\prod\terraform.tfvars",

    # Modules
    r"modules\S3\main.tf":              r"modules\S3\main.tf",
    r"modules\S3\variables.tf":         r"modules\S3\variables.tf",
    r"modules\S3\outputs.tf":           r"modules\S3\outputs.tf",
    r"modules\database\main.tf":        r"modules\database\main.tf",
    r"modules\database\variables.tf":   r"modules\database\variables.tf",
    r"modules\database\outputs.tf":     r"modules\database\outputs.tf",
    r"modules\iam\main.tf":             r"modules\iam\main.tf",
    r"modules\iam\variables.tf":        r"modules\iam\variables.tf",
    r"modules\iam\outputs.tf":          r"modules\iam\outputs.tf",

    # GitHub workflows
    r".github\workflows\terraform-pr.yml":     r".github\workflows\terraform-pr.yml",
    r".github\workflows\terraform-apply.yml":  r".github\workflows\terraform-apply.yml",
    r".github\workflows\aionos-platform.yml":  r".github\workflows\aionos-platform.yml",
}

src_base = Path(r"C:\Users\Akram.Khan\Downloads\terraform_files")

print("\nAIonOS - Installing Terraform Files")
print("="*50)

copied = 0
skipped = 0

for src_rel, dst_rel in files.items():
    src = src_base / src_rel
    dst = BASE / dst_rel

    dst.parent.mkdir(parents=True, exist_ok=True)

    if src.exists():
        shutil.copy2(src, dst)
        print(f"  COPIED  {dst_rel}")
        copied += 1
    else:
        print(f"  SKIP    {src_rel} (not found in downloads)")
        skipped += 1

print(f"\nDone: {copied} copied, {skipped} skipped")
print("\nNew modules added:")
print("  modules/database/  - RDS Database")
print("  modules/iam/       - IAM Roles")
print("\nEnvironments populated:")
print("  environments/dev/     - Complete")
print("  environments/staging/ - Complete")
print("  environments/prod/    - Complete")
