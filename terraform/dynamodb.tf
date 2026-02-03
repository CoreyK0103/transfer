resource "aws_dynamodb_table" "file_info" {
  name         = "file-info-table"
  hash_key     = "fileId"
  billing_mode = "PAY_PER_REQUEST"

  attribute {
    name = "fileId"
    type = "S"
  }
}
