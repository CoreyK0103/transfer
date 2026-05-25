output "api_endpoint" {
  value = aws_apigatewayv2_api.presigned_url_api.api_endpoint
}

output "user_pool_id" {
  value = aws_cognito_user_pool.pool.id
}

output "client_id" {
  value = aws_cognito_user_pool_client.client.id
}
