data "aws_sesv2_email_identity" "email_sender" {
  email_identity = var.email_sender
}