output "rds_endpoint" {
  description = "The connection endpoint for the Amazon RDS PostgreSQL instance"
  value       = aws_db_instance.postgres_instance.endpoint
}

output "rds_address" {
  description = "The hostname of the RDS database instance"
  value       = aws_db_instance.postgres_instance.address
}

output "rds_port" {
  description = "The port on which PostgreSQL accepts connections"
  value       = aws_db_instance.postgres_instance.port
}

output "rds_proxy_endpoint" {
  description = "The connection endpoint for the Amazon RDS Proxy (connection pooler)"
  value       = var.enable_rds_proxy ? aws_db_proxy.postgres_proxy[0].endpoint : "RDS Proxy disabled"
}

output "db_secret_arn" {
  description = "The ARN of the AWS Secrets Manager secret storing database credentials"
  value       = aws_secretsmanager_secret.db_secret.arn
}

output "db_secret_name" {
  description = "The name of the AWS Secrets Manager secret"
  value       = aws_secretsmanager_secret.db_secret.name
}

output "app_compute_security_group_id" {
  description = "Security group ID for application compute instances/containers"
  value       = aws_security_group.app_compute_sg.id
}

output "rds_security_group_id" {
  description = "Security group ID attached to the RDS instance"
  value       = aws_security_group.rds_sg.id
}
