variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "location" {
  description = "Bucket location (region, multi-region, or dual-region)"
  type        = string
  default     = "US"
}

variable "buckets" {
  description = "Map of Cloud Storage buckets to create"
  type = map(object({
    location                    = optional(string, "")
    storage_class               = optional(string, "STANDARD")
    force_destroy               = optional(bool, false)
    public_access_prevention    = optional(string, "enforced")
    uniform_bucket_level_access = optional(bool, true)
    versioning_enabled          = optional(bool, false)

    # Lifecycle rules
    lifecycle_rules = optional(list(object({
      action_type          = string
      storage_class        = optional(string, "")
      age_days             = optional(number, 0)
      num_newer_versions   = optional(number, 0)
      with_state           = optional(string, "ANY")
    })), [])

    # CORS
    cors = optional(list(object({
      origins          = list(string)
      methods          = list(string)
      response_headers = optional(list(string), [])
      max_age_seconds  = optional(number, 3600)
    })), [])

    # Logging
    log_bucket        = optional(string, "")
    log_object_prefix = optional(string, "")

    labels = optional(map(string), {})
  }))
  default = {}
}

variable "labels" {
  description = "Default labels applied to all buckets (merged with per-bucket labels)"
  type        = map(string)
  default     = {}
}
