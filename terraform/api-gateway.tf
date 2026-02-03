resource "aws_apigatewayv2_api" "presigned_url_api" {
  name          = "${local.resource_prefix}-presigned-url-api"
  protocol_type = "HTTP"
}

resource "aws_apigatewayv2_integration" "lambda_integration" {
  api_id                 = aws_apigatewayv2_api.presigned_url_api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = module.presigned_url.lambda_function_invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "post_route" {
  api_id    = aws_apigatewayv2_api.presigned_url_api.id
  route_key = "POST /"
  target    = "integrations/${aws_apigatewayv2_integration.lambda_integration.id}"
}

resource "aws_apigatewayv2_stage" "default_stage" {
  api_id      = aws_apigatewayv2_api.presigned_url_api.id
  name        = "$default"
  auto_deploy = true
}
