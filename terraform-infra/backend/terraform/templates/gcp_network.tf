# ============================================================
# GCP VPC Network Template — AIonOS Platform
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

# ── Region ───────────────────────────────────────────────────
variable "region" {
  type    = string
  default = "us-central1"
}

# ── Network Core ─────────────────────────────────────────────
variable "network_name" { type = string }
variable "description" {
  type    = string
  default = ""
}
variable "auto_create_subnetworks" {
  type    = bool
  default = false
}
variable "routing_mode" {
  type    = string
  default = "REGIONAL"
}
variable "mtu" {
  type    = number
  default = 1460
}
variable "environment" {
  type    = string
  default = "dev"
}

# ── Subnet (custom mode only) ─────────────────────────────────
variable "create_subnet" {
  type    = bool
  default = false
}
variable "subnet_name" {
  type    = string
  default = ""
}
variable "subnet_cidr" {
  type    = string
  default = "10.0.0.0/24"
}
variable "subnet_region" {
  type    = string
  default = "us-central1"
}
variable "private_google_access" {
  type    = bool
  default = true
}

# ── Firewall Rules ────────────────────────────────────────────
variable "allow_ssh" {
  type    = bool
  default = false
}
variable "allow_http" {
  type    = bool
  default = false
}
variable "allow_https" {
  type    = bool
  default = false
}
variable "allow_internal" {
  type    = bool
  default = true
}

# ── Resources ────────────────────────────────────────────────

resource "google_compute_network" "vpc" {
  name                    = var.network_name
  description             = var.description
  auto_create_subnetworks = var.auto_create_subnetworks
  routing_mode            = var.routing_mode
  mtu                     = var.mtu
}

resource "google_compute_subnetwork" "subnet" {
  count                    = var.create_subnet && !var.auto_create_subnetworks ? 1 : 0
  name                     = var.subnet_name != "" ? var.subnet_name : "${var.network_name}-subnet"
  ip_cidr_range            = var.subnet_cidr
  region                   = var.subnet_region
  network                  = google_compute_network.vpc.id
  private_ip_google_access = var.private_google_access
}

resource "google_compute_firewall" "allow_internal" {
  count   = var.allow_internal ? 1 : 0
  name    = "${var.network_name}-allow-internal"
  network = google_compute_network.vpc.name

  allow {
    protocol = "tcp"
    ports    = ["0-65535"]
  }
  allow {
    protocol = "udp"
    ports    = ["0-65535"]
  }
  allow {
    protocol = "icmp"
  }

  source_ranges = ["10.0.0.0/8"]
  description   = "Allow internal traffic"
}

resource "google_compute_firewall" "allow_ssh" {
  count   = var.allow_ssh ? 1 : 0
  name    = "${var.network_name}-allow-ssh"
  network = google_compute_network.vpc.name

  allow {
    protocol = "tcp"
    ports    = ["22"]
  }

  source_ranges = ["0.0.0.0/0"]
  description   = "Allow SSH from anywhere"
}

resource "google_compute_firewall" "allow_http" {
  count   = var.allow_http ? 1 : 0
  name    = "${var.network_name}-allow-http"
  network = google_compute_network.vpc.name

  allow {
    protocol = "tcp"
    ports    = ["80"]
  }

  source_ranges = ["0.0.0.0/0"]
  description   = "Allow HTTP"
}

resource "google_compute_firewall" "allow_https" {
  count   = var.allow_https ? 1 : 0
  name    = "${var.network_name}-allow-https"
  network = google_compute_network.vpc.name

  allow {
    protocol = "tcp"
    ports    = ["443"]
  }

  source_ranges = ["0.0.0.0/0"]
  description   = "Allow HTTPS"
}

# ── Outputs ──────────────────────────────────────────────────

output "network_name" {
  value = google_compute_network.vpc.name
}

output "network_id" {
  value = google_compute_network.vpc.id
}

output "self_link" {
  value = google_compute_network.vpc.self_link
}

output "subnet_name" {
  value = length(google_compute_subnetwork.subnet) > 0 ? google_compute_subnetwork.subnet[0].name : ""
}

output "subnet_cidr" {
  value = length(google_compute_subnetwork.subnet) > 0 ? google_compute_subnetwork.subnet[0].ip_cidr_range : ""
}

output "gateway_ipv4" {
  value = length(google_compute_subnetwork.subnet) > 0 ? google_compute_subnetwork.subnet[0].gateway_address : ""
}
