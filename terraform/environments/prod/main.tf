# ==============================================================================
# SECUREFLOW - Production Environment Architecture
# ==============================================================================

terraform {
  required_version = ">= 1.7.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.40"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "SecureFlow"
      Environment = "Production"
      ManagedBy   = "Terraform"
      CostCenter  = "Core-Infrastructure"
    }
  }
}

variable "aws_region" {
  type    = string
  default = "us-east-1"
}

module "vpc" {
  source      = "../../modules/vpc"
  environment = "prod"
}

module "rds" {
  source      = "../../modules/rds"
  environment = "prod"
  vpc_id      = module.vpc.vpc_id
  subnet_ids  = module.vpc.private_subnet_ids
}

module "ecs" {
  source      = "../../modules/ecs"
  environment = "prod"
  vpc_id      = module.vpc.vpc_id
  subnet_ids  = module.vpc.private_subnet_ids
}

output "vpc_id" {
  value = module.vpc.vpc_id
}

output "rds_endpoint" {
  value = module.rds.endpoint
}

output "ecs_cluster_name" {
  value = module.ecs.cluster_name
}
