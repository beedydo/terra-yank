# File generated and managed by cloud platform
#
# See Terraform S3 backend configuration
# https://developer.hashicorp.com/terraform/language/backend/s3#configuration

terraform {
  backend "s3" {
    bucket       = "your-terraform-state-bucket"
    key          = "terra-yank-acbe0e74-0bf5-439c-b18d-8478e6a6c489"
    use_lockfile = true
    encrypt      = true
  }
}