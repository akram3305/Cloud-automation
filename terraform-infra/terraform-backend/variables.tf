variable "aws_region" {
  type    = string
  default = "ap-south-1"
}

variable "state_bucket_name" {
  type    = string
  default = "aionos-terraform-state-3305"
}

variable "dynamodb_table_name" {
  type    = string
  default = "terraform-lock"
}
