# ============================================================
# Keypair Static Template
# Values injected via terraform.tfvars — do not hardcode here
# ============================================================

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }
    local = {
      source  = "hashicorp/local"
      version = "~> 2.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
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

variable "key_save_path" {
  type    = string
  default = "./keys"
}

variable "tags" {
  type    = map(string)
  default = {}
}

# ── Module ───────────────────────────────────────────────────

module "keypair" {
  source           = "../../../../modules/keypair"
  generate_new_key = true
  key_name         = var.resource_name
  rsa_bits         = 4096
  save_locally     = true
  local_key_path   = var.key_save_path
  environment      = var.environment
  tags             = var.tags
}

# ── Outputs ──────────────────────────────────────────────────

output "key_name" {
  value = module.keypair.key_name
}

output "private_key_path" {
  value = module.keypair.private_key_path
}

output "public_key" {
  value = module.keypair.public_key
}