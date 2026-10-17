terraform {
  required_version = ">= 1.9, < 2.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
  default_tags {
    tags = { Project = "rootpilot-c64", ManagedBy = "Terraform" }
  }
}

provider "aws" {
  alias  = "certificate"
  region = "us-east-1"
  default_tags {
    tags = { Project = "rootpilot-c64", ManagedBy = "Terraform" }
  }
}
