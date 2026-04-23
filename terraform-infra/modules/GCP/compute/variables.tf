variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region"
  type        = string
  default     = "us-central1"
}

variable "zone" {
  description = "GCP zone for instances (leave empty to use region-level distribution)"
  type        = string
  default     = ""
}

variable "instances" {
  description = "Map of Compute Engine instances to create"
  type = map(object({
    machine_type     = optional(string, "e2-medium")
    zone             = optional(string, "")
    boot_image       = optional(string, "debian-cloud/debian-12")
    boot_disk_size   = optional(number, 50)
    boot_disk_type   = optional(string, "pd-ssd")
    network          = optional(string, "default")
    subnetwork       = optional(string, "")
    assign_public_ip = optional(bool, false)
    tags             = optional(list(string), [])
    metadata         = optional(map(string), {})
    startup_script   = optional(string, "")
    service_account_email  = optional(string, "")
    service_account_scopes = optional(list(string), ["https://www.googleapis.com/auth/cloud-platform"])
    deletion_protection = optional(bool, false)
    labels           = optional(map(string), {})
    additional_disks = optional(list(object({
      disk_name = string
      disk_type = optional(string, "pd-ssd")
      disk_size = optional(number, 100)
      auto_delete = optional(bool, true)
    })), [])
  }))
  default = {}
}

# --- Firewall rules ---
variable "firewall_rules" {
  description = "Map of firewall rules to create"
  type = map(object({
    direction    = optional(string, "INGRESS")
    priority     = optional(number, 1000)
    ranges       = optional(list(string), ["0.0.0.0/0"])
    protocol     = string
    ports        = optional(list(string), [])
    target_tags  = optional(list(string), [])
    source_tags  = optional(list(string), [])
    description  = optional(string, "")
  }))
  default = {}
}

# --- Instance template (for managed instance groups) ---
variable "create_instance_template" {
  description = "Whether to create a managed instance group template"
  type        = bool
  default     = false
}

variable "instance_template_name" {
  description = "Name prefix for the instance template"
  type        = string
  default     = ""
}

variable "template_machine_type" {
  description = "Machine type for instance template"
  type        = string
  default     = "e2-medium"
}

variable "template_boot_image" {
  description = "Boot image for instance template"
  type        = string
  default     = "debian-cloud/debian-12"
}

variable "template_startup_script" {
  description = "Startup script for instance template"
  type        = string
  default     = ""
}

variable "labels" {
  description = "Labels to apply to all resources"
  type        = map(string)
  default     = {}
}
