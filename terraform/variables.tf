variable "lambda_runtime" {
  description = "The runtime environment for the Lambda function."
  type        = string
}

variable "account_id" {
  type = string
}

variable "region" {
  type = string
}

variable "lambda_timeout" {
  type = number
}

variable "environment" {
  type = string
}

variable "namespace" {
  type = string
}
