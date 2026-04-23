# ============================================================
# GCP Cloud Storage Bucket Template — AIonOS Platform
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

# ── Core ─────────────────────────────────────────────────────
variable "bucket_name" { type = string }
variable "region" {
  type    = string
  default = "US"
}
variable "environment" {
  type    = string
  default = "dev"
}

# ── Location ─────────────────────────────────────────────────
variable "location_type" {
  type    = string
  default = "REGION"
  # REGION | MULTI_REGION | DUAL_REGION
}

# ── Storage class ─────────────────────────────────────────────
variable "storage_class" {
  type    = string
  default = "STANDARD"
  # STANDARD | NEARLINE | COLDLINE | ARCHIVE
}

# ── Access control ────────────────────────────────────────────
variable "uniform_bucket_access" {
  type    = bool
  default = true
}

variable "public_access_prevention" {
  type    = string
  default = "enforced"
  # enforced | inherited
}

# ── Versioning ────────────────────────────────────────────────
variable "versioning_enabled" {
  type    = bool
  default = false
}

# ── Lifecycle ─────────────────────────────────────────────────
variable "lifecycle_age_days" {
  type    = number
  default = 0
  # 0 = disabled; > 0 = delete objects older than N days
}

variable "lifecycle_to_nearline_days" {
  type    = number
  default = 0
  # 0 = disabled
}

variable "lifecycle_to_coldline_days" {
  type    = number
  default = 0
  # 0 = disabled
}

# ── CORS ──────────────────────────────────────────────────────
variable "enable_cors" {
  type    = bool
  default = false
}

variable "cors_origins" {
  type    = list(string)
  default = ["*"]
}

# ── Labels ────────────────────────────────────────────────────
variable "labels" {
  type    = map(string)
  default = {}
}

# ── Force destroy ─────────────────────────────────────────────
variable "force_destroy" {
  type    = bool
  default = false
}

# ── Resources ────────────────────────────────────────────────

resource "google_storage_bucket" "bucket" {
  name                        = var.bucket_name
  location                    = var.region
  storage_class               = var.storage_class
  force_destroy               = var.force_destroy
  public_access_prevention    = var.public_access_prevention

  uniform_bucket_level_access = var.uniform_bucket_access

  labels = merge(var.labels, {
    environment = var.environment
    managed_by  = "terraform"
  })

  dynamic "versioning" {
    for_each = var.versioning_enabled ? [1] : []
    content {
      enabled = true
    }
  }

  dynamic "lifecycle_rule" {
    for_each = var.lifecycle_age_days > 0 ? [1] : []
    content {
      action { type = "Delete" }
      condition { age = var.lifecycle_age_days }
    }
  }

  dynamic "lifecycle_rule" {
    for_each = var.lifecycle_to_nearline_days > 0 ? [1] : []
    content {
      action {
        type          = "SetStorageClass"
        storage_class = "NEARLINE"
      }
      condition { age = var.lifecycle_to_nearline_days }
    }
  }

  dynamic "lifecycle_rule" {
    for_each = var.lifecycle_to_coldline_days > 0 ? [1] : []
    content {
      action {
        type          = "SetStorageClass"
        storage_class = "COLDLINE"
      }
      condition { age = var.lifecycle_to_coldline_days }
    }
  }

  dynamic "cors" {
    for_each = var.enable_cors ? [1] : []
    content {
      origin          = var.cors_origins
      method          = ["GET", "HEAD", "PUT", "POST", "DELETE"]
      response_header = ["*"]
      max_age_seconds = 3600
    }
  }
}

# ── Outputs ──────────────────────────────────────────────────

output "bucket_name" {
  value = google_storage_bucket.bucket.name
}

output "bucket_url" {
  value = google_storage_bucket.bucket.url
}

output "bucket_self_link" {
  value = google_storage_bucket.bucket.self_link
}

output "storage_class" {
  value = google_storage_bucket.bucket.storage_class
}

output "location" {
  value = google_storage_bucket.bucket.location
}
