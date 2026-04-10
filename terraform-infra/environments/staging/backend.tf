terraform {
  backend "s3" {
    bucket         = "aionos-terraform-state-3305"
    key            = "staging/infra/terraform.tfstate"
    region         = "ap-south-1"
    dynamodb_table = "terraform-lock"
    encrypt        = true
  }
}
