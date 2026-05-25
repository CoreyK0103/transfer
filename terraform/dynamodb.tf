resource "aws_dynamodb_table" "file_info" {
  name         = "${local.resource_prefix}-file-info-table"
  hash_key     = "fileId"
  billing_mode = "PAY_PER_REQUEST"

  attribute {
    name = "fileId"
    type = "S"
  }

  tags = {
    Environment = var.environment
  }
}
