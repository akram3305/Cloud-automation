# ============================================================
# VPC Static Template
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

variable "vpc_cidr" {
  type    = string
  default = "10.0.0.0/16"
}

variable "availability_zones" {
  type    = list(string)
  default = ["ap-south-1a", "ap-south-1b"]
}

variable "public_subnets" {
  type    = list(string)
  default = ["10.0.1.0/24"]
}

variable "private_subnets" {
  type    = list(string)
  default = ["10.0.11.0/24"]
}

variable "enable_nat_gateway" {
  type    = bool
  default = false
}

variable "tags" {
  type    = map(string)
  default = {}
}

# ── Module ───────────────────────────────────────────────────

module "vpc" {
  source             = "../../../../modules/vpc"
  vpc_name           = var.resource_name
  vpc_cidr           = var.vpc_cidr
  availability_zones = var.availability_zones
  public_subnets     = var.public_subnets
  private_subnets    = var.private_subnets

  enable_nat_gateway     = var.enable_nat_gateway
  single_nat_gateway     = true
  one_nat_gateway_per_az = false
  enable_flow_logs       = false

  environment = var.environment
  tags        = var.tags
}

# ── Outputs ──────────────────────────────────────────────────

output "vpc_id" {
  value = module.vpc.vpc_id
}

output "public_subnet_ids" {
  value = module.vpc.public_subnet_ids
}

output "private_subnet_ids" {
  value = module.vpc.private_subnet_ids
}

output "nat_gateway_ids" {
  value = module.vpc.nat_gateway_ids
}