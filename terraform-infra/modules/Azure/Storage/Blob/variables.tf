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
  default     = "nonprod"
  validation {
    condition     = contains(["prod", "nonprod", "connectivity"], var.subscription)
    error_message = "subscription must be prod, nonprod, or connectivity"
  }
}

variable "storage_accounts" {
  type = map(object({
    account_tier             = optional(string, "Standard")
    account_replication_type = optional(string, "LRS")
    account_kind             = optional(string, "StorageV2")
    access_tier              = optional(string, "Hot")

    # Security
    enable_https_traffic_only       = optional(bool, true)
    min_tls_version                 = optional(string, "TLS1_2")
    allow_nested_items_to_be_public = optional(bool, false)
    shared_access_key_enabled       = optional(bool, true)

    # Versioning & soft delete
    blob_versioning_enabled            = optional(bool, false)
    blob_soft_delete_retention_days    = optional(number, 7)
    container_soft_delete_retention_days = optional(number, 7)

    # Network rules
    network_default_action = optional(string, "Allow")
    ip_rules               = optional(list(string), [])
    subnet_ids             = optional(list(string), [])

    # Containers
    containers = optional(map(object({
      access_type = optional(string, "private")
    })), {})

    tags = optional(map(string), {})
  }))
  description = "Map of storage account name => config"
}
