# ============================================================
# GCP Compute Engine Instance Template — AIonOS Platform
# Values injected via terraform.tfvars — do not hardcode here
# State stored in AWS S3 (same backend as AWS/Azure resources)
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

# ── Auth & Project ───────────────────────────────────────────
variable "credentials_file" { type = string }
variable "project_id"       { type = string }

# ── Region / Zone ────────────────────────────────────────────
variable "region" {
  type    = string
  default = "us-central1"
}
variable "zone" {
  type    = string
  default = "us-central1-a"
}

# ── Instance Core ────────────────────────────────────────────
variable "resource_name" { type = string }
variable "environment" {
  type    = string
  default = "dev"
}
variable "machine_type" {
  type    = string
  default = "e2-medium"
}

# ── Boot Disk ────────────────────────────────────────────────
variable "boot_image" {
  type    = string
  default = "debian-cloud/debian-12"
}
variable "boot_disk_size" {
  type    = number
  default = 50
}
variable "boot_disk_type" {
  type    = string
  default = "pd-balanced"
}

# ── Networking ───────────────────────────────────────────────
variable "network" {
  type    = string
  default = "default"
}
variable "subnetwork" {
  type    = string
  default = ""
}
variable "assign_public_ip" {
  type    = bool
  default = false
}

# ── Scheduling ───────────────────────────────────────────────
variable "preemptible" {
  type    = bool
  default = false
}

# ── Metadata / Startup ───────────────────────────────────────
variable "startup_script" {
  type    = string
  default = ""
}
variable "ssh_keys_metadata" {
  type    = string
  default = ""
}

# ── Tags / Labels ────────────────────────────────────────────
variable "network_tags" {
  type    = list(string)
  default = []
}
variable "labels" {
  type    = map(string)
  default = {}
}

# ── Firewall ─────────────────────────────────────────────────
variable "firewall_ports" {
  type    = list(string)
  default = []
}
variable "firewall_source_range" {
  type    = string
  default = "0.0.0.0/0"
}

# ── Resources ────────────────────────────────────────────────

locals {
  script_trimmed = trimspace(var.startup_script)
  ssh_trimmed    = trimspace(var.ssh_keys_metadata)
  extra_metadata = merge(
    # Disable OS Login so instance-level ssh-keys metadata is always honoured.
    # Without this, a project/org OS Login policy silently ignores ssh-keys and
    # every SSH attempt fails with "Permission denied (publickey)".
    { "enable-oslogin" = "false" },
    local.script_trimmed != "" ? { "startup-script" = local.script_trimmed } : {},
    local.ssh_trimmed    != "" ? { "ssh-keys"        = local.ssh_trimmed    } : {}
  )
}

resource "google_compute_instance" "this" {
  name         = var.resource_name
  machine_type = var.machine_type
  zone         = var.zone

  boot_disk {
    initialize_params {
      image = var.boot_image
      size  = var.boot_disk_size
      type  = var.boot_disk_type
    }
  }

  network_interface {
    network    = var.network
    subnetwork = var.subnetwork != "" ? var.subnetwork : null

    dynamic "access_config" {
      for_each = var.assign_public_ip ? [1] : []
      content {}
    }
  }

  tags = concat(
    var.network_tags,
    length(var.firewall_ports) > 0 ? ["${var.resource_name}-fw"] : []
  )

  labels = merge(var.labels, {
    environment = var.environment
    managed-by  = "aionos-platform"
  })

  metadata = local.extra_metadata

  scheduling {
    preemptible       = var.preemptible
    automatic_restart = var.preemptible ? false : true
  }
}

# ── Firewall rule (only created when firewall_ports is non-empty) ────────────

resource "google_compute_firewall" "instance_rules" {
  count   = length(var.firewall_ports) > 0 ? 1 : 0
  name    = "${var.resource_name}-allow"
  network = var.network
  project = var.project_id

  allow {
    protocol = "tcp"
    ports    = var.firewall_ports
  }

  source_ranges = [var.firewall_source_range]
  target_tags   = ["${var.resource_name}-fw"]

  description = "Auto-created by AIonOS for instance ${var.resource_name}"
}

# ── Outputs ──────────────────────────────────────────────────

output "instance_id" {
  value = google_compute_instance.this.instance_id
}

output "self_link" {
  value = google_compute_instance.this.self_link
}

output "public_ip" {
  value = var.assign_public_ip ? try(google_compute_instance.this.network_interface[0].access_config[0].nat_ip, "") : ""
}

output "private_ip" {
  value = google_compute_instance.this.network_interface[0].network_ip
}
