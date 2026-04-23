# ============================================================
# EC2 — self-contained template (no external module)
# Values injected via terraform.tfvars
# ============================================================

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
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

# ── EC2 Instance ─────────────────────────────────────────────

resource "aws_instance" "this" {
  ami                         = var.ami
  instance_type               = var.instance_type
  subnet_id                   = var.subnet_id != "" ? var.subnet_id : null
  key_name                    = var.key_name != "" ? var.key_name : null
  vpc_security_group_ids      = length(var.security_group_ids) > 0 ? var.security_group_ids : null
  associate_public_ip_address = var.associate_public_ip
  monitoring                  = var.monitoring
  disable_api_termination     = var.disable_api_termination

  root_block_device {
    volume_type           = var.root_volume_type
    volume_size           = var.root_volume_size
    delete_on_termination = var.root_volume_delete_on_termination
    encrypted             = var.root_volume_encrypted
  }

  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "optional"
    http_put_response_hop_limit = 1
    instance_metadata_tags      = "enabled"
  }

  tags = merge(var.tags, {
    Name        = var.resource_name
    Environment = var.environment
  })

  lifecycle {
    ignore_changes = [ami]
  }
}

# ── Outputs ──────────────────────────────────────────────────

output "instance_id" {
  value = aws_instance.this.id
}

output "public_ip" {
  value = aws_instance.this.public_ip
}

output "private_ip" {
  value = aws_instance.this.private_ip
}
