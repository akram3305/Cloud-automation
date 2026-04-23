variable "cluster_name" {
  description = "Name of the AKS cluster"
  type        = string
}

variable "resource_group_name" {
  description = "Resource group where the AKS cluster is deployed"
  type        = string
}

variable "location" {
  description = "Azure region"
  type        = string
}

variable "dns_prefix" {
  description = "DNS prefix for the cluster"
  type        = string
}

variable "kubernetes_version" {
  description = "Kubernetes version (leave null for latest)"
  type        = string
  default     = null
}

# --- Default node pool ---
variable "default_node_pool_name" {
  description = "Name of the default node pool"
  type        = string
  default     = "system"
}

variable "default_node_pool_vm_size" {
  description = "VM size for default node pool nodes"
  type        = string
  default     = "Standard_D2s_v3"
}

variable "default_node_pool_min_count" {
  description = "Minimum node count (autoscaling)"
  type        = number
  default     = 1
}

variable "default_node_pool_max_count" {
  description = "Maximum node count (autoscaling)"
  type        = number
  default     = 3
}

variable "default_node_pool_node_count" {
  description = "Initial node count (used when autoscaling is disabled)"
  type        = number
  default     = 2
}

variable "enable_auto_scaling" {
  description = "Enable cluster autoscaler on default node pool"
  type        = bool
  default     = true
}

variable "os_disk_size_gb" {
  description = "OS disk size in GB for node pool nodes"
  type        = number
  default     = 128
}

variable "os_disk_type" {
  description = "OS disk type: Managed or Ephemeral"
  type        = string
  default     = "Managed"
  validation {
    condition     = contains(["Managed", "Ephemeral"], var.os_disk_type)
    error_message = "os_disk_type must be Managed or Ephemeral."
  }
}

variable "node_pool_availability_zones" {
  description = "List of availability zones for the default node pool"
  type        = list(string)
  default     = ["1", "2", "3"]
}

# --- Networking ---
variable "vnet_subnet_id" {
  description = "Subnet ID to deploy AKS nodes into (required for custom VNet)"
  type        = string
  default     = null
}

variable "network_plugin" {
  description = "Network plugin: azure (CNI) or kubenet"
  type        = string
  default     = "azure"
  validation {
    condition     = contains(["azure", "kubenet"], var.network_plugin)
    error_message = "network_plugin must be azure or kubenet."
  }
}

variable "network_policy" {
  description = "Network policy: azure or calico"
  type        = string
  default     = "azure"
}

variable "service_cidr" {
  description = "CIDR used by Kubernetes services"
  type        = string
  default     = "10.0.0.0/16"
}

variable "dns_service_ip" {
  description = "IP address within the service CIDR for kube-dns"
  type        = string
  default     = "10.0.0.10"
}

# --- Identity ---
variable "identity_type" {
  description = "Managed identity type: SystemAssigned or UserAssigned"
  type        = string
  default     = "SystemAssigned"
}

# --- Add-ons ---
variable "enable_azure_policy" {
  description = "Enable the Azure Policy add-on"
  type        = bool
  default     = true
}

variable "enable_oms_agent" {
  description = "Enable OMS agent (Log Analytics) add-on"
  type        = bool
  default     = false
}

variable "log_analytics_workspace_id" {
  description = "Log Analytics workspace ID (required when enable_oms_agent = true)"
  type        = string
  default     = null
}

variable "enable_http_application_routing" {
  description = "Enable HTTP application routing add-on (dev only)"
  type        = bool
  default     = false
}

# --- RBAC ---
variable "enable_azure_rbac" {
  description = "Enable Azure RBAC for Kubernetes authorization"
  type        = bool
  default     = true
}

variable "admin_group_object_ids" {
  description = "AAD group object IDs granted cluster-admin"
  type        = list(string)
  default     = []
}

# --- Extra node pools ---
variable "additional_node_pools" {
  description = "Map of additional node pools to create"
  type = map(object({
    vm_size             = string
    node_count          = optional(number, 1)
    min_count           = optional(number, 1)
    max_count           = optional(number, 5)
    enable_auto_scaling = optional(bool, true)
    os_disk_size_gb     = optional(number, 128)
    node_labels         = optional(map(string), {})
    node_taints         = optional(list(string), [])
    availability_zones  = optional(list(string), ["1", "2", "3"])
    mode                = optional(string, "User")
  }))
  default = {}
}

# --- Tags ---
variable "tags" {
  description = "Tags to apply to all AKS resources"
  type        = map(string)
  default     = {}
}
