resource "aws_apigatewayv2_api" "presigned_url_api" {
  name          = "${local.resource_prefix}-presigned-url-api"
  protocol_type = "HTTP"

  tags = {
    Environment = var.environment
  }
}

resource "aws_apigatewayv2_authorizer" "cognito" {
  api_id = aws_apigatewayv2_api.api.id
  name   = "${local.resource_prefix}-cognito-authorizer"

  authorizer_type = "JWT"

  identity_sources = ["$request.header.Authorization"]

  jwt_configuration {
    audience = [aws_cognito_user_pool_client.client.id]
    issuer   = "https://cognito-idp.${var.region}.amazonaws.com/${aws_cognito_user_pool.pool.id}"
  }
}

resource "aws_apigatewayv2_integration" "lambda_integration" {
  api_id                 = aws_apigatewayv2_api.presigned_url_api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = module.presigned_url.lambda_function_invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "post_route" {
  api_id             = aws_apigatewayv2_api.presigned_url_api.id
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
  route_key          = "POST /"
  target             = "integrations/${aws_apigatewayv2_integration.lambda_integration.id}"
}

resource "aws_apigatewayv2_stage" "default_stage" {
  api_id      = aws_apigatewayv2_api.presigned_url_api.id
  name        = "$default"
  auto_deploy = true

  tags = {
    Environment = var.environment
  }
}
