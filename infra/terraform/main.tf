terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
  }
}

provider "aws" {
  region = var.aws_region
  default_tags {
    tags = {
      Project     = "UI-Freshers-Companion"
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}

# =========================================================================
# 1. NETWORKING (VPC & ISOLATED PRIVATE SUBNETS)
# =========================================================================

resource "aws_vpc" "app_vpc" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "ui-freshers-${var.environment}-vpc"
  }
}

resource "aws_subnet" "public_subnets" {
  count                   = length(var.public_subnet_cidrs)
  vpc_id                  = aws_vpc.app_vpc.id
  cidr_block              = var.public_subnet_cidrs[count.index]
  availability_zone       = var.availability_zones[count.index]
  map_public_ip_on_launch = true

  tags = {
    Name = "ui-freshers-public-subnet-${count.index + 1}"
    Type = "Public"
  }
}

resource "aws_subnet" "private_subnets" {
  count             = length(var.private_subnet_cidrs)
  vpc_id            = aws_vpc.app_vpc.id
  cidr_block        = var.private_subnet_cidrs[count.index]
  availability_zone = var.availability_zones[count.index]

  tags = {
    Name = "ui-freshers-private-db-subnet-${count.index + 1}"
    Type = "Private-Database"
  }
}

resource "aws_internet_gateway" "gw" {
  vpc_id = aws_vpc.app_vpc.id

  tags = {
    Name = "ui-freshers-${var.environment}-igw"
  }
}

resource "aws_route_table" "public_rt" {
  vpc_id = aws_vpc.app_vpc.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.gw.id
  }

  tags = {
    Name = "ui-freshers-public-rt"
  }
}

resource "aws_route_table_association" "public_assoc" {
  count          = length(var.public_subnet_cidrs)
  subnet_id      = aws_subnet.public_subnets[count.index].id
  route_table_id = aws_route_table.public_rt.id
}

# RDS DB Subnet Group placed strictly in Private Subnets (No public IP)
resource "aws_db_subnet_group" "rds_subnet_group" {
  name        = "ui-freshers-${var.environment}-db-subnet-group"
  description = "Private isolated database subnet group for UI Freshers RDS"
  subnet_ids  = aws_subnet.private_subnets[*].id

  tags = {
    Name = "ui-freshers-db-subnet-group"
  }
}

# =========================================================================
# 2. SECURITY GROUPS (STRICT ZERO-TRUST INGRESS)
# =========================================================================

# Application Compute Security Group (ECS Tasks / EC2 / Lambda / App Server)
resource "aws_security_group" "app_compute_sg" {
  name        = "ui-freshers-${var.environment}-app-compute-sg"
  description = "Security group for UI Freshers application compute tier"
  vpc_id      = aws_vpc.app_vpc.id

  egress {
    description = "Allow all outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "ui-freshers-app-compute-sg"
  }
}

# RDS Security Group: strictly permits Port 5432 ingress ONLY from App Compute SG
resource "aws_security_group" "rds_sg" {
  name        = "ui-freshers-${var.environment}-rds-sg"
  description = "Strict firewall for UI Freshers PostgreSQL RDS instance"
  vpc_id      = aws_vpc.app_vpc.id

  ingress {
    description     = "Allow PostgreSQL from application compute security group"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.app_compute_sg.id]
  }

  egress {
    description = "Allow outbound responses"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "ui-freshers-rds-sg"
  }
}

# =========================================================================
# 3. SECRETS MANAGEMENT & CREDENTIAL GENERATION
# =========================================================================

resource "random_password" "master_db_password" {
  length           = 28
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

resource "aws_secretsmanager_secret" "db_secret" {
  name                    = "ui-freshers/${var.environment}/rds-postgres-credentials"
  description             = "Database master credentials and connection strings for UI Freshers Companion"
  recovery_window_in_days = 7

  tags = {
    Name = "ui-freshers-db-secret"
  }
}

resource "aws_secretsmanager_secret_version" "db_secret_val" {
  secret_id = aws_secretsmanager_secret.db_secret.id
  secret_string = jsonencode({
    engine   = "postgres"
    host     = aws_db_instance.postgres_instance.address
    port     = aws_db_instance.postgres_instance.port
    username = var.db_username
    password = random_password.master_db_password.result
    dbname   = var.db_name
    sslmode  = "require"
    DATABASE_URL = "postgresql://${var.db_username}:${random_password.master_db_password.result}@${aws_db_instance.postgres_instance.address}:${aws_db_instance.postgres_instance.port}/${var.db_name}?sslmode=require"
  })
}

# =========================================================================
# 4. DATABASE PARAMETER GROUP (ENFORCE SSL/TLS)
# =========================================================================

resource "aws_db_parameter_group" "postgres_pg" {
  name        = "ui-freshers-${var.environment}-pg16-params"
  family      = "postgres16"
  description = "PostgreSQL 16 parameter group with SSL enforcement"

  parameter {
    name  = "rds.force_ssl"
    value = "1" # Force SSL/TLS on all incoming database connections
  }

  parameter {
    name  = "log_connections"
    value = "1"
  }

  parameter {
    name  = "log_disconnections"
    value = "1"
  }

  tags = {
    Name = "ui-freshers-postgres16-params"
  }
}

# =========================================================================
# 5. AMAZON RDS POSTGRESQL INSTANCE
# =========================================================================

resource "aws_db_instance" "postgres_instance" {
  identifier        = "ui-freshers-${var.environment}-postgres"
  engine            = "postgres"
  engine_version    = "16.3"
  instance_class    = var.db_instance_class
  allocated_storage = var.db_allocated_storage
  max_allocated_storage = var.db_max_allocated_storage
  storage_type      = "gp3"
  storage_encrypted = true

  db_name  = var.db_name
  username = var.db_username
  password = random_password.master_db_password.result
  port     = 5432

  db_subnet_group_name   = aws_db_subnet_group.rds_subnet_group.name
  vpc_security_group_ids = [aws_security_group.rds_sg.id]
  parameter_group_name   = aws_db_parameter_group.postgres_pg.name

  publicly_accessible = false # Strictly private, non-routable over public internet
  multi_az            = var.enable_multi_az

  backup_retention_period   = var.backup_retention_days
  backup_window             = "03:00-04:00"
  maintenance_window        = "Sun:04:30-Sun:05:30"
  auto_minor_version_upgrade = true
  copy_tags_to_snapshot     = true
  deletion_protection       = var.environment == "production" ? true : false
  skip_final_snapshot       = var.environment == "production" ? false : true
  final_snapshot_identifier = "ui-freshers-${var.environment}-final-snapshot"

  iam_database_authentication_enabled = true # Supports AWS IAM DB Auth for zero-password compute

  tags = {
    Name = "ui-freshers-postgres-rds"
  }
}

# =========================================================================
# 6. IAM ROLE & POLICIES (FOR APP COMPUTE ACCESS & IAM AUTH)
# =========================================================================

resource "aws_iam_policy" "app_db_access_policy" {
  name        = "ui-freshers-${var.environment}-db-access-policy"
  description = "IAM policy granting compute service permission to read Secrets Manager and connect via RDS IAM DB Auth"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "ReadSecretsManager"
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret"
        ]
        Resource = [aws_secretsmanager_secret.db_secret.arn]
      },
      {
        Sid    = "RDSConnectViaIAM"
        Effect = "Allow"
        Action = [
          "rds-db:connect"
        ]
        Resource = [
          "arn:aws:rds-db:${var.aws_region}:*:dbuser:${aws_db_instance.postgres_instance.resource_id}/*"
        ]
      }
    ]
  })
}

# =========================================================================
# 7. CONNECTION POOLING: AWS RDS PROXY (OPTIONAL SCALING LAYER)
# =========================================================================

resource "aws_iam_role" "rds_proxy_role" {
  count = var.enable_rds_proxy ? 1 : 0
  name  = "ui-freshers-${var.environment}-rds-proxy-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "rds.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy" "rds_proxy_policy" {
  count = var.enable_rds_proxy ? 1 : 0
  name  = "ui-freshers-${var.environment}-rds-proxy-policy"
  role  = aws_iam_role.rds_proxy_role[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = "secretsmanager:GetSecretValue"
        Resource = aws_secretsmanager_secret.db_secret.arn
      }
    ]
  })
}

resource "aws_db_proxy" "postgres_proxy" {
  count                  = var.enable_rds_proxy ? 1 : 0
  name                   = "ui-freshers-${var.environment}-db-proxy"
  debug_logging          = false
  engine_family          = "POSTGRESQL"
  idle_client_timeout    = 1800
  require_tls            = true
  role_arn               = aws_iam_role.rds_proxy_role[0].arn
  vpc_subnet_ids         = aws_subnet.private_subnets[*].id
  vpc_security_group_ids = [aws_security_group.rds_sg.id]

  auth {
    auth_scheme = "SECRETS"
    secret_arn  = aws_secretsmanager_secret.db_secret.arn
    iam_auth    = "DISABLED"
  }

  tags = {
    Name = "ui-freshers-rds-proxy"
  }
}

resource "aws_db_proxy_default_target_group" "proxy_target_group" {
  count         = var.enable_rds_proxy ? 1 : 0
  db_proxy_name = aws_db_proxy.postgres_proxy[0].name

  connection_pool_config {
    connection_borrow_timeout    = 120
    max_connections_percent      = 90
    max_idle_connections_percent = 50
  }
}

resource "aws_db_proxy_target" "proxy_target" {
  count                  = var.enable_rds_proxy ? 1 : 0
  db_proxy_name          = aws_db_proxy.postgres_proxy[0].name
  target_group_name      = aws_db_proxy_default_target_group.proxy_target_group[0].name
  db_instance_identifier = aws_db_instance.postgres_instance.id
}
