# ---- Object Scan Result Rule and Target ----
resource "aws_cloudwatch_event_rule" "object_scanned_rule" {
  name = "${local.resource_prefix}-object-scanned-rule"

  event_pattern = jsonencode({
    source        = ["aws.guardduty"]
    "detail-type" = ["GuardDuty Malware Protection Object Scan Result"]
  })

  tags = {
    Environment = var.environment
  }
}

resource "aws_cloudwatch_event_target" "object_scanned_target" {
  rule = aws_cloudwatch_event_rule.object_scanned_rule.id
  arn  = aws_sqs_queue.object_scanned.arn
}
