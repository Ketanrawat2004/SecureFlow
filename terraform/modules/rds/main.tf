# ==============================================================================
# SECUREFLOW - RDS PostgreSQL Terraform Module
# Multi-AZ PostgreSQL 16 cluster with encryption at rest
# ==============================================================================

variable "environment" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "subnet_ids" {
  type = list(string)
}

variable "db_instance_class" {
  type    = string
  default = "db.t4g.medium"
}

resource "aws_db_subnet_group" "rds" {
  name       = "secureflow-rds-subnet-group-${var.environment}"
  subnet_ids = var.subnet_ids

  tags = {
    Name        = "secureflow-rds-subnet-group-${var.environment}"
    Environment = var.environment
  }
}

resource "aws_security_group" "rds" {
  name        = "secureflow-rds-sg-${var.environment}"
  description = "Controls database ingress traffic from ECS backend tasks"
  vpc_id      = var.vpc_id

  ingress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/16"]
    description = "PostgreSQL access from VPC CIDR"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "secureflow-rds-sg-${var.environment}"
    Environment = var.environment
  }
}

resource "aws_db_instance" "postgres" {
  identifier             = "secureflow-db-${var.environment}"
  engine                 = "postgres"
  engine_version         = "16.2"
  instance_class         = var.db_instance_class
  allocated_storage      = 50
  max_allocated_storage  = 200
  storage_type           = "gp3"
  storage_encrypted      = true
  db_name                = "secureflow_prod"
  username               = "secureflow_admin"
  password               = "ChangeMeInProductionVaultSecret2026!"
  db_subnet_group_name   = aws_db_subnet_group.rds.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  multi_az               = true
  skip_final_snapshot    = false
  deletion_protection    = true

  tags = {
    Name        = "secureflow-postgres-${var.environment}"
    Environment = var.environment
    Compliance  = "SOC2-Type2"
  }
}

output "endpoint" {
  value = aws_db_instance.postgres.endpoint
}

output "db_name" {
  value = aws_db_instance.postgres.db_name
}
