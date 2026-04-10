
# Keypair: test-terra-key (req_25)
module "keypair_test_terra_key" {
  source           = "../../modules/keypair"
  generate_new_key = true
  key_name         = "test-terra-key"
  rsa_bits         = 4096
  save_locally     = true
  local_key_path   = "C:/Users/Akram.Khan/Downloads"
  environment      = "dev"
  tags = {
    Name        = "test-terra-key"
    Project     = "AIonOS-Platform"
    Owner       = "admin"
    Environment = "dev"
    CreatedBy   = "AIonOS-Platform"
    RequestID   = "25"
  }
}
output "keypair_test_terra_key_name"             { value = module.keypair_test_terra_key.key_name }
output "keypair_test_terra_key_private_key_path" { value = module.keypair_test_terra_key.private_key_path }
