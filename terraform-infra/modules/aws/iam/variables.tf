variable "environment" { type = string }

variable "roles" {
  description = "Map of IAM roles to create"
  type = map(object({
    name            = string
    type            = string
    description     = optional(string, "Created by AIonOS Platform")
    extra_policies  = optional(list(string), [])
  }))
  default = {}
}

variable "tags" {
  type    = map(string)
  default = {}
}
