variable "gcp_project_id" {
  type        = string
  description = "GCP Project ID"
}

variable "gcp_region" {
  type        = string
  default     = "us-central1"
  description = "Default GCP region"
}

variable "gcp_credentials_json" {
  type        = string
  sensitive   = true
  description = "GCP Service Account credentials JSON (contents, not path)"
}
