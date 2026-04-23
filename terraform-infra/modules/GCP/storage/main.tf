locals {
  default_labels = merge(var.labels, {
    managed_by = "terraform"
    module     = "gcp-storage"
  })
}

# ---------------------------------------------------------------------------
# Cloud Storage buckets
# ---------------------------------------------------------------------------
resource "google_storage_bucket" "this" {
  for_each = var.buckets

  name          = each.key
  location      = each.value.location != "" ? each.value.location : var.location
  project       = var.project_id
  storage_class = each.value.storage_class
  force_destroy = each.value.force_destroy

  public_access_prevention    = each.value.public_access_prevention
  uniform_bucket_level_access = each.value.uniform_bucket_level_access

  versioning {
    enabled = each.value.versioning_enabled
  }

  dynamic "lifecycle_rule" {
    for_each = each.value.lifecycle_rules
    content {
      action {
        type          = lifecycle_rule.value.action_type
        storage_class = lifecycle_rule.value.storage_class != "" ? lifecycle_rule.value.storage_class : null
      }
      condition {
        age                   = lifecycle_rule.value.age_days > 0 ? lifecycle_rule.value.age_days : null
        num_newer_versions    = lifecycle_rule.value.num_newer_versions > 0 ? lifecycle_rule.value.num_newer_versions : null
        with_state            = lifecycle_rule.value.with_state != "ANY" ? lifecycle_rule.value.with_state : null
      }
    }
  }

  dynamic "cors" {
    for_each = each.value.cors
    content {
      origin          = cors.value.origins
      method          = cors.value.methods
      response_header = cors.value.response_headers
      max_age_seconds = cors.value.max_age_seconds
    }
  }

  dynamic "logging" {
    for_each = each.value.log_bucket != "" ? [1] : []
    content {
      log_bucket        = each.value.log_bucket
      log_object_prefix = each.value.log_object_prefix
    }
  }

  labels = merge(local.default_labels, each.value.labels)
}
