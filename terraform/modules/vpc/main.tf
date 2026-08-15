# ==============================================================================
# SECUREFLOW - VPC Terraform Module
# Multi-AZ VPC with Public & Private Subnets and NAT Gateways
# ==============================================================================

variable "environment" {
  type        = string
  description = "Environment identifier (e.g. prod, staging)"
}

variable "cidr_block" {
  type        = string
  default     = "10.0.0.0/16"
  description = "Primary IPv4 CIDR block for VPC"
}

variable "availability_zones" {
  type        = list(string)
  default     = ["us-east-1a", "us-east-1b"]
  description = "Availability zones for multi-AZ high availability"
}

resource "aws_vpc" "main" {
  cidr_block           = var.cidr_block
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = {
    Name        = "secureflow-vpc-${var.environment}"
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

resource "aws_internet_gateway" "igw" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name        = "secureflow-igw-${var.environment}"
    Environment = var.environment
  }
}

resource "aws_subnet" "public" {
  count                   = length(var.availability_zones)
  vpc_id                  = aws_vpc.main.id
  cidr_block              = cidrsubnet(var.cidr_block, 4, count.index)
  availability_zone       = var.availability_zones[count.index]
  map_public_ip_on_launch = true

  tags = {
    Name        = "secureflow-public-subnet-${count.index + 1}-${var.environment}"
    Environment = var.environment
    Type        = "Public"
  }
}

resource "aws_subnet" "private" {
  count             = length(var.availability_zones)
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(var.cidr_block, 4, count.index + 4)
  availability_zone = var.availability_zones[count.index]

  tags = {
    Name        = "secureflow-private-subnet-${count.index + 1}-${var.environment}"
    Environment = var.environment
    Type        = "Private"
  }
}

output "vpc_id" {
  value = aws_vpc.main.id
}

output "public_subnet_ids" {
  value = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  value = aws_subnet.private[*].id
}
