data "archive_file" "lambda_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../dist"
  output_path = "${path.module}/../lambda.zip"
}

module "presigned_url" {
  source = "git::https://github.com/terraform-aws-modules/terraform-aws-lambda.git?ref=v8.4.0"

  function_name = "${local.resource_prefix}-presigned-url-getter"
  handler       = "upload-url/index.handler"
  runtime       = var.lambda_runtime

  create_package         = false
  local_existing_package = "${path.module}/../lambda.zip"

  cloudwatch_logs_retention_in_days = 1

  environment_variables = {
    LANDING_BUCKET_NAME = module.landing_bucket.s3_bucket_id
  }

  attach_policy_statements = true
  policy_statements = [
    {
      effect = "Allow",
      actions = [
        "s3:PutObject"
      ],
      resources = [
        "${module.landing_bucket.s3_bucket_arn}/*",
      ]
    }
  ]

  create_current_version_allowed_triggers = false

  allowed_triggers = {
    APIGateway = {
      service    = "apigateway",
      source_arn = "${aws_apigatewayv2_api.presigned_url_api.execution_arn}/*/*"
    }
  }
}


