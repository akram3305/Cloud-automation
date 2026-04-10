# ============================================================
# EC2 Static Template
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

variable "ami" {
  type = string
}

variable "instance_type" {
  type = string
}

variable "subnet_id" {
  type    = string
  default = ""
}

variable "key_name" {
  type    = string
  default = ""
}

variable "security_group_ids" {
  type    = list(string)
  default = []
}

variable "associate_public_ip" {
  type    = bool
  default = true
}

variable "monitoring" {
  type    = bool
  default = false
}

variable "disable_api_termination" {
  type    = bool
  default = false
}

variable "root_volume_type" {
  type    = string
  default = "gp3"
}

variable "root_volume_size" {
  type    = number
  default = 20
}

variable "root_volume_delete_on_termination" {
  type    = bool
  default = true
}

variable "root_volume_encrypted" {
  type    = bool
  default = false
}

variable "tags" {
  type    = map(string)
  default = {}
}

# ── Module ───────────────────────────────────────────────────

module "ec2" {
  source      = "../../../../modules/compute/ec2"
  environment = var.environment

  instances = {
    (var.resource_name) = {
      ami                               = var.ami
      instance_type                     = var.instance_type
      subnet_id                         = var.subnet_id
      vpc_security_group_ids            = var.security_group_ids
      key_name                          = var.key_name
      associate_public_ip_address       = var.associate_public_ip
      monitoring                        = var.monitoring
      disable_api_termination           = var.disable_api_termination
      root_volume_type                  = var.root_volume_type
      root_volume_size                  = var.root_volume_size
      root_volume_delete_on_termination = var.root_volume_delete_on_termination
      root_volume_encrypted             = var.root_volume_encrypted
      metadata_http_endpoint            = "enabled"
      metadata_http_tokens              = "optional"
      metadata_http_hop_limit           = 1
      metadata_instance_tags            = "enabled"
      tags                              = var.tags
    }
  }
}

# ── Outputs ──────────────────────────────────────────────────

output "instance_id" {
  value = try(values(module.ec2.instance_ids)[0], "")
}

output "public_ip" {
  value = try(values(module.ec2.public_ips)[0], "")
}

output "private_ip" {
  value = try(values(module.ec2.private_ips)[0], "")
}