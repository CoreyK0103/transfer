# ---- Landing Bucket ----
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

# ---- Clean Bucket ---- 
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

resource "aws_s3_bucket_notification" "clean_object_notification" {
  bucket = module.clean_bucket.s3_bucket_id

  queue {
    queue_arn     = aws_sqs_queue.clean_object_queue.arn
    events        = ["s3:ObjectCreated:*"]
    filter_suffix = ".log"
  }

  depends_on = [aws_sqs_queue_policy.clean_object_queue_policy]
}

# ---- Quarantine Bucket ----
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
