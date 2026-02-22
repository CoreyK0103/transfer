variable "lambda_runtime" {
  description = "The runtime environment for the Lambda function."
  type        = string
  default     = "nodejs24.x"
}

variable "account_id" {
  type = string
}

variable "region" {
  type    = string
  default = "eu-west-2"
}

variable "lambda_timeout" {
  type    = number
  default = 30
}

variable "environment" {
  type = string
}

variable "namespace" {
  type = string
}

variable "email_sender" {
  type = string
}

variable "batch_size" {
  type    = number
  default = 10
}
