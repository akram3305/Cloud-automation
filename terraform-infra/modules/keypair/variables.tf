variable "generate_new_key" {
  description = "Create new key or use existing"
  type        = bool
  default     = true
}

variable "key_name" {
  description = "Key pair name"
  type        = string
  default     = ""
}

variable "rsa_bits" {
  description = "RSA key size"
  type        = number
  default     = 4096
}

variable "save_locally" {
  description = "Save private key locally"
  type        = bool
  default     = true
}

variable "local_key_path" {
  description = "Path to save key"
  type        = string
  default     = "./keys"
}

variable "overwrite_existing" {
  description = "Overwrite existing key"
  type        = bool
  default     = false
}

variable "tags" {
  type    = map(string)
  default = {}
}

variable "environment" {
  type = string
}