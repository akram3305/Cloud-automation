module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 6.6.0"

  # VPC + CIDR
  name = var.vpc_name
  cidr = var.vpc_cidr

  # Multi-AZ
  azs = var.availability_zones

  # Public Subnets
  public_subnets = var.public_subnets
  public_subnet_tags = merge(
    var.public_subnet_tags,
    {
      "kubernetes.io/role/elb" = "1"
      "Tier"                   = "public"
    }
  )

  # Private Subnets
  private_subnets = var.private_subnets
  private_subnet_tags = merge(
    var.private_subnet_tags,
    {
      "kubernetes.io/role/internal-elb" = "1"
      "Tier"                            = "private"
    }
  )

  # Internet Gateway
  create_igw = true

  # NAT Gateway
  # The vpc module internally creates and manages EIPs for NAT gateways.
  # Do NOT create aws_eip resources manually — it causes duplicates.
  enable_nat_gateway     = var.enable_nat_gateway
  single_nat_gateway     = var.single_nat_gateway
  one_nat_gateway_per_az = var.one_nat_gateway_per_az

  # DNS
  enable_dns_hostnames = true
  enable_dns_support   = true

  # VPC Flow Logs
  enable_flow_log                      = var.enable_flow_logs
  create_flow_log_cloudwatch_log_group = var.enable_flow_logs
  create_flow_log_cloudwatch_iam_role  = var.enable_flow_logs
  flow_log_max_aggregation_interval    = 60
  flow_log_destination_type            = var.flow_log_destination_type
  flow_log_traffic_type                = "ALL"

  # Security Hardening — lock down default SG
  manage_default_security_group  = true
  default_security_group_ingress = []
  default_security_group_egress  = []

  # Per-AZ subnet tags
  public_subnet_tags_per_az  = var.public_subnet_tags_per_az
  private_subnet_tags_per_az = var.private_subnet_tags_per_az

  # Tags
  tags = merge(
    var.tags,
    {
      ManagedBy   = "terraform"
      Environment = var.environment
    }
  )
}