# ============================================================
# S3 Static Template
# Values injected via terraform.tfvars — do not hardcode here
# ============================================================

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }

  backend "s3" {}
}

provider "aws" {
  region = var.region
}

# ── Variables ────────────────────────────────────────────────

variable "region" {
  type = string
}

variable "environment" {
  type = string
}

variable "resource_name" {
  type = string
}

variable "versioning_enabled" {
  type    = bool
  default = false
}

variable "encryption_type" {
  type    = string
  default = "AES256"
}

variable "tags" {
  type    = map(string)
  default = {}
}

# ── Module ───────────────────────────────────────────────────

module "s3" {
  source             = "../../../../modules/S3"
  bucket_name        = var.resource_name
  force_destroy      = false
  versioning_enabled = var.versioning_enabled
  encryption_type    = var.encryption_type
  bucket_key_enabled = true

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true

  tags = var.tags
}

# ── Outputs ──────────────────────────────────────────────────

output "bucket_name" {
  value = module.s3.bucket_name
}

output "bucket_arn" {
  value = module.s3.bucket_arn
}

output "bucket_id" {
  value = module.s3.bucket_id
}