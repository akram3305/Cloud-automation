output "bucket_id"                  { value = aws_s3_bucket.this.id }
output "bucket_arn"                 { value = aws_s3_bucket.this.arn }
output "bucket_name"                { value = aws_s3_bucket.this.bucket }
output "bucket_regional_domain_name"{ value = aws_s3_bucket.this.bucket_regional_domain_name }
output "bucket_region"              { value = aws_s3_bucket.this.region }
output "versioning_status"          { value = aws_s3_bucket_versioning.this.versioning_configuration[0].status }
