#!/bin/bash
# Web server setup for ${environment}
set -euo pipefail

yum update -y 2>/dev/null || apt-get update -y 2>/dev/null || true

# Install nginx
amazon-linux-extras install nginx1 -y 2>/dev/null ||   apt-get install -y nginx 2>/dev/null ||   yum install -y nginx 2>/dev/null || true

systemctl enable nginx
systemctl start nginx

echo "Web server ready on ${hostname}"
