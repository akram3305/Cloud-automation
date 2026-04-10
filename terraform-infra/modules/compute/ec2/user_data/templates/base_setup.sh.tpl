#!/bin/bash
# Base setup script for ${environment} environment
# Hostname: ${hostname}
set -euo pipefail

# Update system
yum update -y 2>/dev/null || apt-get update -y 2>/dev/null || true

# Install SSM agent
yum install -y amazon-ssm-agent 2>/dev/null || true
systemctl enable amazon-ssm-agent 2>/dev/null || true
systemctl start amazon-ssm-agent 2>/dev/null || true

# Set hostname
hostnamectl set-hostname ${hostname} 2>/dev/null || true

echo "Setup complete for ${hostname} in ${environment}"
