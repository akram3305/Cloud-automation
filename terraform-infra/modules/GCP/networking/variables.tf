variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "Default GCP region for subnets"
  type        = string
  default     = "us-central1"
}

# --- VPC ---
variable "vpc_name" {
  description = "Name of the VPC network"
  type        = string
}

variable "auto_create_subnetworks" {
  description = "Auto-create subnetworks (set false for custom-mode VPC)"
  type        = bool
  default     = false
}

variable "routing_mode" {
  description = "VPC routing mode: REGIONAL or GLOBAL"
  type        = string
  default     = "REGIONAL"
}

variable "mtu" {
  description = "Maximum transmission unit (1460 default, 8896 for jumbo frames)"
  type        = number
  default     = 1460
}

# --- Subnets ---
variable "subnets" {
  description = "Map of subnets to create in the VPC"
  type = map(object({
    region                   = optional(string, "")
    cidr                     = string
    private_google_access    = optional(bool, true)
    flow_logs_enabled        = optional(bool, false)
    flow_logs_sampling       = optional(number, 0.5)
    secondary_ranges = optional(list(object({
      range_name    = string
      ip_cidr_range = string
    })), [])
  }))
  default = {}
}

# --- Cloud NAT / Cloud Router ---
variable "create_cloud_nat" {
  description = "Create a Cloud NAT gateway for private instance internet access"
  type        = bool
  default     = false
}

variable "cloud_router_name" {
  description = "Name of the Cloud Router (used for NAT)"
  type        = string
  default     = ""
}

variable "nat_name" {
  description = "Name of the Cloud NAT"
  type        = string
  default     = ""
}

variable "nat_ip_allocate_option" {
  description = "NAT IP allocation: AUTO_ONLY or MANUAL_ONLY"
  type        = string
  default     = "AUTO_ONLY"
}

variable "nat_source_subnetwork_ip_ranges" {
  description = "Which subnetworks to use for NAT: ALL_SUBNETWORKS_ALL_IP_RANGES or LIST_OF_SUBNETWORKS"
  type        = string
  default     = "ALL_SUBNETWORKS_ALL_IP_RANGES"
}

# --- VPC Peering ---
variable "vpc_peerings" {
  description = "Map of VPC peering connections"
  type = map(object({
    peer_vpc_self_link             = string
    export_custom_routes           = optional(bool, false)
    import_custom_routes           = optional(bool, false)
    export_subnet_routes_with_public_ip = optional(bool, true)
  }))
  default = {}
}

# --- Firewall rules ---
variable "firewall_rules" {
  description = "Map of VPC-level firewall rules"
  type = map(object({
    direction   = optional(string, "INGRESS")
    priority    = optional(number, 1000)
    ranges      = optional(list(string), ["0.0.0.0/0"])
    protocol    = string
    ports       = optional(list(string), [])
    target_tags = optional(list(string), [])
    source_tags = optional(list(string), [])
    description = optional(string, "")
  }))
  default = {}
}

variable "labels" {
  description = "Labels applied to resources that support them"
  type        = map(string)
  default     = {}
}
