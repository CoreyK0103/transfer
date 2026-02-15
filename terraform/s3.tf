module "landing_bucket" {
  source = "git::https://github.com/terraform-aws-modules/terraform-aws-s3-bucket.git?ref=v5.10.0"

  bucket        = "${local.resource_prefix}-landing-bucket"
  force_destroy = true
  lifecycle_rule = [
    {
      id     = "Expiration"
      status = "Enabled"
      expiration = {
        days = 7
      }
    }
  ]

  tags = {
    Environment = var.environment
  }
}

module "clean_bucket" {
  source = "git::https://github.com/terraform-aws-modules/terraform-aws-s3-bucket.git?ref=v5.10.0"

  bucket        = "${local.resource_prefix}-clean-bucket"
  force_destroy = true
  lifecycle_rule = [
    {
      id     = "Expiration"
      status = "Enabled"
      expiration = {
        days = 7
      }
    }
  ]

  tags = {
    Environment = var.environment
  }
}

module "quarantine_bucket" {
  source = "git::https://github.com/terraform-aws-modules/terraform-aws-s3-bucket.git?ref=v5.10.0"

  bucket        = "${local.resource_prefix}-quarantine-bucket"
  force_destroy = true
  lifecycle_rule = [
    {
      id     = "Expiration"
      status = "Enabled"
      expiration = {
        days = 7
      }
    }
  ]

  tags = {
    Environment = var.environment
  }
}
