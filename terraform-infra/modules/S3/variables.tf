variable "bucket_name" {
  type = string
}

variable "force_destroy" {
  type    = bool
  default = false
}

variable "tags" {
  type    = map(string)
  default = {}
}

variable "versioning_enabled" {
  type    = bool
  default = false
}

variable "encryption_type" {
  type    = string
  default = "AES256"
}

variable "kms_key_id" {
  type      = string
  default   = null
  sensitive = true
}

variable "bucket_key_enabled" {
  type    = bool
  default = true
}

variable "block_public_acls" {
  type    = bool
  default = true
}

variable "block_public_policy" {
  type    = bool
  default = true
}

variable "ignore_public_acls" {
  type    = bool
  default = true
}

variable "restrict_public_buckets" {
  type    = bool
  default = true
}
