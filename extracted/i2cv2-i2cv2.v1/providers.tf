terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0.0, < 6.0.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = ">= 2.0.0, < 3.0.0"
    }
  }

  # the Terraform version is tied to the image used in pipeline jobs; ensure that the pipeline
  # is updated to a version with an image that supports the desired Terraform version
  required_version = "1.12.1"
}
