variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region for the GKE cluster"
  type        = string
}

variable "cluster_name" {
  description = "Name of the GKE cluster"
  type        = string
}

variable "network" {
  description = "VPC network name or self_link"
  type        = string
  default     = "default"
}

variable "subnetwork" {
  description = "Subnetwork name or self_link"
  type        = string
  default     = "default"
}

variable "kubernetes_version" {
  description = "Kubernetes / GKE version (leave empty for latest release channel)"
  type        = string
  default     = ""
}

variable "release_channel" {
  description = "GKE release channel: UNSPECIFIED, RAPID, REGULAR, or STABLE"
  type        = string
  default     = "REGULAR"
}

# --- Cluster config ---
variable "regional_cluster" {
  description = "Create a regional (HA) cluster; false for zonal"
  type        = bool
  default     = true
}

variable "cluster_zones" {
  description = "Zones for nodes in a regional cluster (empty = all zones in region)"
  type        = list(string)
  default     = []
}

variable "private_cluster" {
  description = "Create a private cluster (no public endpoint on nodes)"
  type        = bool
  default     = true
}

variable "enable_private_endpoint" {
  description = "Disable the public endpoint of the cluster master"
  type        = bool
  default     = false
}

variable "master_ipv4_cidr_block" {
  description = "CIDR for the master VPN (e.g. 172.16.0.32/28)"
  type        = string
  default     = "172.16.0.32/28"
}

variable "master_authorized_networks" {
  description = "List of authorized CIDR blocks that can access the master"
  type = list(object({
    cidr_block   = string
    display_name = string
  }))
  default = []
}

# --- Pod/Service CIDRs (VPC-native) ---
variable "pods_ipv4_cidr_block" {
  description = "Secondary range name or CIDR for pods"
  type        = string
  default     = ""
}

variable "services_ipv4_cidr_block" {
  description = "Secondary range name or CIDR for services"
  type        = string
  default     = ""
}

variable "cluster_secondary_range_name" {
  description = "Name of the secondary range for pods (VPC-native)"
  type        = string
  default     = ""
}

variable "services_secondary_range_name" {
  description = "Name of the secondary range for services (VPC-native)"
  type        = string
  default     = ""
}

# --- Default node pool ---
variable "remove_default_node_pool" {
  description = "Remove the default node pool after cluster creation"
  type        = bool
  default     = true
}

# --- Node pools ---
variable "node_pools" {
  description = "Map of node pools to create"
  type = map(object({
    machine_type        = optional(string, "e2-standard-4")
    disk_size_gb        = optional(number, 100)
    disk_type           = optional(string, "pd-ssd")
    image_type          = optional(string, "COS_CONTAINERD")
    min_count           = optional(number, 1)
    max_count           = optional(number, 5)
    initial_node_count  = optional(number, 1)
    preemptible         = optional(bool, false)
    spot                = optional(bool, false)
    auto_repair         = optional(bool, true)
    auto_upgrade        = optional(bool, true)
    node_locations      = optional(list(string), [])
    node_labels         = optional(map(string), {})
    node_taints = optional(list(object({
      key    = string
      value  = string
      effect = string
    })), [])
    service_account     = optional(string, "")
    oauth_scopes        = optional(list(string), ["https://www.googleapis.com/auth/cloud-platform"])
  }))
  default = {
    default = {
      machine_type = "e2-standard-4"
      min_count    = 1
      max_count    = 3
    }
  }
}

# --- Add-ons ---
variable "enable_http_load_balancing" {
  description = "Enable HTTP load balancing add-on"
  type        = bool
  default     = true
}

variable "enable_horizontal_pod_autoscaling" {
  description = "Enable horizontal pod autoscaling"
  type        = bool
  default     = true
}

variable "enable_network_policy" {
  description = "Enable Kubernetes network policy enforcement"
  type        = bool
  default     = true
}

variable "enable_workload_identity" {
  description = "Enable Workload Identity for pod-level GCP IAM"
  type        = bool
  default     = true
}

# --- Logging & Monitoring ---
variable "logging_service" {
  description = "Logging service: logging.googleapis.com/kubernetes or none"
  type        = string
  default     = "logging.googleapis.com/kubernetes"
}

variable "monitoring_service" {
  description = "Monitoring service: monitoring.googleapis.com/kubernetes or none"
  type        = string
  default     = "monitoring.googleapis.com/kubernetes"
}

variable "labels" {
  description = "Labels to apply to the cluster and node pools"
  type        = map(string)
  default     = {}
}
