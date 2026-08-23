variable "aws_region" {
  description = "AWS region for deployment (e.g. eu-north-1 Stockholm or eu-west-1 Ireland)"
  type        = string
  default     = "eu-north-1"
}

variable "environment" {
  description = "Deployment environment name (e.g. production, staging, dev)"
  type        = string
  default     = "production"
}

variable "vpc_cidr" {
  description = "CIDR block for the custom VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "List of Availability Zones for high availability subnet placement"
  type        = list(string)
  default     = ["eu-north-1a", "eu-north-1b"]
}

variable "private_subnet_cidrs" {
  description = "CIDR blocks for private database subnets"
  type        = list(string)
  default     = ["10.0.10.0/24", "10.0.11.0/24"]
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for public app/ingress subnets"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24"]
}

variable "db_instance_class" {
  description = "RDS instance class (e.g. db.t4g.micro for cost-efficient starter, db.r6g.large for production)"
  type        = string
  default     = "db.t4g.micro"
}

variable "db_allocated_storage" {
  description = "Allocated SSD storage in GB (gp3)"
  type        = number
  default     = 20
}

variable "db_max_allocated_storage" {
  description = "Maximum storage limit for autoscaling in GB"
  type        = number
  default     = 100
}

variable "db_name" {
  description = "PostgreSQL database name"
  type        = string
  default     = "ui_freshers"
}

variable "db_username" {
  description = "Master database administrator username"
  type        = string
  default     = "ui_db_admin"
}

variable "enable_multi_az" {
  description = "Enable Multi-AZ high availability failover (recommended for Production)"
  type        = bool
  default     = false # Toggle to true for production high availability
}

variable "backup_retention_days" {
  description = "Automated daily backup retention window in days"
  type        = number
  default     = 7
}

variable "enable_rds_proxy" {
  description = "Deploy AWS RDS Proxy for connection pooling under high concurrent user load"
  type        = bool
  default     = true
}
