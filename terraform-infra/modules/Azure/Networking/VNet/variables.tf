variable "environment" {
  type        = string
  description = "Deployment environment (dev, staging, prod)"
}

variable "resource_group_name" {
  type        = string
  description = "Azure Resource Group name"
}

variable "location" {
  type        = string
  description = "Azure region"
}

variable "subscription" {
  type        = string
  description = "Subscription alias: prod, nonprod, or connectivity"
  default     = "connectivity"
  validation {
    condition     = contains(["prod", "nonprod", "connectivity"], var.subscription)
    error_message = "subscription must be prod, nonprod, or connectivity"
  }
}

variable "vnet_name" {
  type        = string
  description = "Name of the Virtual Network"
}

variable "vnet_cidr" {
  type        = string
  description = "Address space for the VNet (e.g. 10.0.0.0/16)"
}

variable "dns_servers" {
  type        = list(string)
  default     = []
  description = "Custom DNS server IPs. Leave empty to use Azure default."
}

variable "subnets" {
  type = map(object({
    cidr                                          = string
    service_endpoints                             = optional(list(string), [])
    delegation_name                               = optional(string)
    delegation_service                            = optional(string)
    private_endpoint_network_policies             = optional(string, "Disabled")
    private_link_service_network_policies_enabled = optional(bool, true)
  }))
  description = "Map of subnet name => subnet config"
  default     = {}
}

variable "peerings" {
  type = map(object({
    remote_vnet_id            = string
    allow_forwarded_traffic   = optional(bool, true)
    allow_gateway_transit     = optional(bool, false)
    use_remote_gateways       = optional(bool, false)
    allow_virtual_network_access = optional(bool, true)
  }))
  description = "Map of peering name => peering config (for Hub-Spoke)"
  default     = {}
}

variable "enable_ddos_protection" {
  type    = bool
  default = false
}

variable "ddos_protection_plan_id" {
  type    = string
  default = null
}

variable "tags" {
  type    = map(string)
  default = {}
}
