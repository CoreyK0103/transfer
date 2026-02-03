data "archive_file" "lambda_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../dist"
  output_path = "${path.module}/../lambda.zip"
}

data "archive_file" "dependencies_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../layer"
  output_path = "${path.module}/../layer/dependencies.zip"
}

resource "aws_lambda_layer_version" "dependencies" {
  filename            = data.archive_file.dependencies_zip.output_path
  source_code_hash    = data.archive_file.dependencies_zip.output_base64sha256
  layer_name          = "${local.resource_prefix}-dependencies"
  compatible_runtimes = [var.lambda_runtime]
}

module "presigned_url" {
  source = "git::https://github.com/terraform-aws-modules/terraform-aws-lambda.git?ref=v8.4.0"

  function_name = "${local.resource_prefix}-presigned-url-getter"
  handler       = "upload-url/index.handler"
  runtime       = var.lambda_runtime

  create_package         = false
  local_existing_package = "${path.module}/../lambda.zip"

  cloudwatch_logs_retention_in_days = 1

  layers = [
    aws_lambda_layer_version.dependencies.arn,
  ]

  environment_variables = {
    LANDING_BUCKET_NAME  = module.landing_bucket.s3_bucket_id
    FILE_INFO_TABLE_NAME = aws_dynamodb_table.file_info.name
  }

  attach_policy_statements = true
  policy_statements = {
    s3 = {
      effect = "Allow",
      actions = [
        "s3:PutObject"
      ],
      resources = [
        "${module.landing_bucket.s3_bucket_arn}/*",
      ]
    },
    dynamodb = {
      effect = "Allow",
      actions = [
        "dynamodb:PutItem"
      ],
      resources = [
        aws_dynamodb_table.file_info.arn
      ]
    }
  }

  create_current_version_allowed_triggers = false

  allowed_triggers = {
    APIGateway = {
      service    = "apigateway",
      source_arn = "${aws_apigatewayv2_api.presigned_url_api.execution_arn}/*/*"
    }
  }
}


