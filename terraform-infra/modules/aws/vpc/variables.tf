# VPC Basic Settings
variable "vpc_name" {
  description = "Name of the VPC"
  type        = string
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
}

variable "availability_zones" {
  description = "List of AZs to deploy resources"
  type        = list(string)
}

# Subnets
variable "public_subnets" {
  description = "List of public subnet CIDRs"
  type        = list(string)
}

variable "private_subnets" {
  description = "List of private subnet CIDRs"
  type        = list(string)
}

variable "public_subnet_tags" {
  description = "Tags for public subnets"
  type        = map(string)
  default     = {}
}

variable "private_subnet_tags" {
  description = "Tags for private subnets"
  type        = map(string)
  default     = {}
}

variable "public_subnet_tags_per_az" {
  description = "Optional map of public subnet tags per AZ"
  type        = map(map(string))
  default     = {}
}

variable "private_subnet_tags_per_az" {
  description = "Optional map of private subnet tags per AZ"
  type        = map(map(string))
  default     = {}
}

# NAT Gateway Settings
variable "enable_nat_gateway" {
  description = "Enable NAT Gateway"
  type        = bool
  default     = true
}

variable "single_nat_gateway" {
  description = "Use single NAT Gateway for all AZs"
  type        = bool
  default     = true
}

variable "one_nat_gateway_per_az" {
  description = "Create one NAT Gateway per AZ"
  type        = bool
  default     = false
}

# Flow Logs
variable "enable_flow_logs" {
  description = "Enable VPC flow logs"
  type        = bool
  default     = false
}

variable "flow_log_destination_type" {
  description = "VPC Flow log destination type (CloudWatchLogs or S3)"
  type        = string
  default     = "CloudWatchLogs"
}

# Tags
variable "tags" {
  description = "Global tags for resources"
  type        = map(string)
  default     = {}
}

variable "environment" {
  description = "Environment tag (dev/prod/staging)"
  type        = string
  default     = "dev"
}