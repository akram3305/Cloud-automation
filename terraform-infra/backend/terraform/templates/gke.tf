# ============================================================
# GKE Cluster Template — AIonOS Platform
# Self-contained (no module references) — state in AWS S3
# ============================================================

terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = ">= 5.0"
    }
  }
  backend "s3" {}
}

provider "google" {
  project     = var.project_id
  region      = var.region
  credentials = var.credentials_file
}

# ── Auth ─────────────────────────────────────────────────────
variable "credentials_file" { type = string }
variable "project_id"       { type = string }

# ── Cluster ──────────────────────────────────────────────────
variable "cluster_name" { type = string }
variable "region" {
  type    = string
  default = "us-central1"
}
variable "environment" {
  type    = string
  default = "dev"
}
variable "release_channel" {
  type    = string
  default = "REGULAR"
}
variable "regional_cluster" {
  type    = bool
  default = true
}

# ── Networking ───────────────────────────────────────────────
variable "network" {
  type    = string
  default = "default"
}
variable "subnetwork" {
  type    = string
  default = "default"
}
variable "private_cluster" {
  type    = bool
  default = false
}
variable "enable_private_endpoint" {
  type    = bool
  default = false
}
variable "master_ipv4_cidr_block" {
  type    = string
  default = "172.16.0.32/28"
}

# ── Node Pool ────────────────────────────────────────────────
variable "node_pool_name" {
  type    = string
  default = "default"
}
variable "machine_type" {
  type    = string
  default = "e2-standard-2"
}
variable "disk_size_gb" {
  type    = number
  default = 100
}
variable "disk_type" {
  type    = string
  default = "pd-ssd"
}
variable "image_type" {
  type    = string
  default = "COS_CONTAINERD"
}
variable "initial_node_count" {
  type    = number
  default = 3
}
variable "min_node_count" {
  type    = number
  default = 1
}
variable "max_node_count" {
  type    = number
  default = 5
}
variable "spot" {
  type    = bool
  default = false
}

# ── Add-ons ──────────────────────────────────────────────────
variable "enable_http_load_balancing" {
  type    = bool
  default = true
}
variable "enable_horizontal_pod_autoscaling" {
  type    = bool
  default = true
}
variable "enable_network_policy" {
  type    = bool
  default = true
}
variable "enable_workload_identity" {
  type    = bool
  default = true
}
variable "enable_logging" {
  type    = bool
  default = true
}
variable "enable_monitoring" {
  type    = bool
  default = true
}

# ── Labels ───────────────────────────────────────────────────
variable "labels" {
  type    = map(string)
  default = {}
}

# ── GKE Cluster ──────────────────────────────────────────────

resource "google_container_cluster" "this" {
  name     = var.cluster_name
  project  = var.project_id
  location = var.regional_cluster ? var.region : "${var.region}-a"

  network    = var.network
  subnetwork = var.subnetwork

  remove_default_node_pool = true
  initial_node_count       = 1

  release_channel {
    channel = var.release_channel
  }

  dynamic "private_cluster_config" {
    for_each = var.private_cluster ? [1] : []
    content {
      enable_private_nodes    = true
      enable_private_endpoint = var.enable_private_endpoint
      master_ipv4_cidr_block  = var.master_ipv4_cidr_block
    }
  }

  ip_allocation_policy {}

  addons_config {
    http_load_balancing {
      disabled = !var.enable_http_load_balancing
    }
    horizontal_pod_autoscaling {
      disabled = !var.enable_horizontal_pod_autoscaling
    }
    network_policy_config {
      disabled = !var.enable_network_policy
    }
  }

  dynamic "network_policy" {
    for_each = var.enable_network_policy ? [1] : []
    content {
      enabled  = true
      provider = "CALICO"
    }
  }

  dynamic "workload_identity_config" {
    for_each = var.enable_workload_identity ? [1] : []
    content {
      workload_pool = "${var.project_id}.svc.id.goog"
    }
  }

  logging_service    = var.enable_logging    ? "logging.googleapis.com/kubernetes"    : "none"
  monitoring_service = var.enable_monitoring ? "monitoring.googleapis.com/kubernetes" : "none"

  resource_labels = merge(var.labels, {
    environment = var.environment
    managed-by  = "aionos-platform"
  })

  timeouts {
    create = "45m"
    update = "45m"
    delete = "45m"
  }

  lifecycle {
    ignore_changes = [initial_node_count]
  }
}

# ── Node Pool ────────────────────────────────────────────────

resource "google_container_node_pool" "primary" {
  name     = var.node_pool_name
  cluster  = google_container_cluster.this.id
  project  = var.project_id
  location = var.regional_cluster ? var.region : "${var.region}-a"

  initial_node_count = var.initial_node_count

  autoscaling {
    min_node_count = var.min_node_count
    max_node_count = var.max_node_count
  }

  management {
    auto_repair  = true
    auto_upgrade = true
  }

  node_config {
    machine_type = var.machine_type
    disk_size_gb = var.disk_size_gb
    disk_type    = var.disk_type
    image_type   = var.image_type
    spot         = var.spot

    oauth_scopes = ["https://www.googleapis.com/auth/cloud-platform"]

    dynamic "workload_metadata_config" {
      for_each = var.enable_workload_identity ? [1] : []
      content {
        mode = "GKE_METADATA"
      }
    }

    shielded_instance_config {
      enable_secure_boot          = true
      enable_integrity_monitoring = true
    }

    labels = merge(var.labels, {
      environment = var.environment
      managed-by  = "aionos-platform"
    })
  }

  timeouts {
    create = "45m"
    update = "45m"
    delete = "45m"
  }

  lifecycle {
    ignore_changes = [initial_node_count]
  }
}

# ── Outputs ──────────────────────────────────────────────────

output "cluster_name" {
  value = google_container_cluster.this.name
}
output "cluster_endpoint" {
  value     = google_container_cluster.this.endpoint
  sensitive = true
}
output "cluster_location" {
  value = google_container_cluster.this.location
}
output "node_pool_name" {
  value = google_container_node_pool.primary.name
}
