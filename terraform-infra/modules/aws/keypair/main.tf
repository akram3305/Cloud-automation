# Generate random suffix
resource "random_string" "suffix" {
  count   = var.generate_new_key ? 1 : 0
  length  = 6
  special = false
  upper   = false
}

# Generate private key
resource "tls_private_key" "this" {
  count = var.generate_new_key ? 1 : 0

  algorithm = "RSA"
  rsa_bits  = var.rsa_bits
}

# Create AWS Key Pair
resource "aws_key_pair" "this" {
  count = var.generate_new_key ? 1 : 0

  key_name = var.key_name != "" ? var.key_name : "key-${random_string.suffix[0].result}"

  public_key = tls_private_key.this[0].public_key_openssh

  tags = merge(var.tags, {
    Name        = var.key_name != "" ? var.key_name : "key-${random_string.suffix[0].result}"
    Environment = var.environment
    ManagedBy   = "terraform"
  })
}

# Save private key locally
resource "local_file" "private_key" {
  count = var.generate_new_key && var.save_locally ? 1 : 0

  content  = tls_private_key.this[0].private_key_pem
  filename = "${var.local_key_path}/${aws_key_pair.this[0].key_name}.pem"

  file_permission = "0400"
}

# Save public key
resource "local_file" "public_key" {
  count = var.generate_new_key && var.save_locally ? 1 : 0

  content  = tls_private_key.this[0].public_key_openssh
  filename = "${var.local_key_path}/${aws_key_pair.this[0].key_name}.pub"

  file_permission = "0644"
}

# Use existing key
data "aws_key_pair" "existing" {
  count = var.generate_new_key ? 0 : 1

  key_name = var.key_name
}