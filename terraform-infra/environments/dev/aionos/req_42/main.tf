terraform {
  required_version = ">= 1.3"
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

# ── Variables ─────────────────────────────────────────────────────────────

variable "region" {
  type    = string
  default = "ap-south-1"
}
variable "environment" {
  type    = string
  default = "dev"
}
variable "cluster_name" {
  type = string
}
variable "kubernetes_version" {
  type    = string
  default = "1.29"
}
variable "node_instance_type" {
  type    = string
  default = "t3.medium"
}
variable "node_count" {
  type    = number
  default = 2
}
variable "min_nodes" {
  type    = number
  default = 1
}
variable "max_nodes" {
  type    = number
  default = 5
}
variable "subnet_ids" {
  type = list(string)
}
variable "cluster_role_arn" {
  type = string
}
variable "node_role_arn" {
  type = string
}
variable "tags" {
  type    = map(string)
  default = {}
}

# ── EKS Cluster ───────────────────────────────────────────────────────────

resource "aws_eks_cluster" "main" {
  name     = var.cluster_name
  role_arn = var.cluster_role_arn
  version  = var.kubernetes_version

  vpc_config {
    subnet_ids              = var.subnet_ids
    endpoint_private_access = true
    endpoint_public_access  = true
  }

  tags = merge(var.tags, {
    Name        = var.cluster_name
    Environment = var.environment
    ManagedBy   = "AIonOS-Terraform"
  })
}

# ── Node Group ────────────────────────────────────────────────────────────

resource "aws_eks_node_group" "main" {
  cluster_name    = aws_eks_cluster.main.name
  node_group_name = "${var.cluster_name}-ng"
  node_role_arn   = var.node_role_arn
  subnet_ids      = var.subnet_ids

  instance_types = [var.node_instance_type]

  scaling_config {
    desired_size = var.node_count
    min_size     = var.min_nodes
    max_size     = var.max_nodes
  }

  update_config {
    max_unavailable = 1
  }

  tags = merge(var.tags, {
    Name        = "${var.cluster_name}-ng"
    Environment = var.environment
    ManagedBy   = "AIonOS-Terraform"
  })

  depends_on = [aws_eks_cluster.main]
}

# ── Outputs ───────────────────────────────────────────────────────────────

output "cluster_name"     { value = aws_eks_cluster.main.name }
output "cluster_endpoint" { value = aws_eks_cluster.main.endpoint }
output "cluster_version"  { value = aws_eks_cluster.main.version }
output "node_group_name"  { value = aws_eks_node_group.main.node_group_name }
output "cluster_arn"      { value = aws_eks_cluster.main.arn }