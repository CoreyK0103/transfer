resource "aws_sqs_queue" "object_scanned" {
  name                       = "${local.resource_prefix}-object-scanned-queue"
  message_retention_seconds  = 86400
  visibility_timeout_seconds = 6 * var.lambda_timeout
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.object_scanned_dlq.arn
    maxReceiveCount     = 3
  })

  tags = {
    Environment = var.environment
  }
}

resource "aws_sqs_queue" "object_scanned_dlq" {
  name = "${local.resource_prefix}-object-scanned-dlq"

  tags = {
    Environment = var.environment
  }
}

resource "aws_sqs_queue_redrive_allow_policy" "object_scanned_redrive_allow_policy" {
  queue_url = aws_sqs_queue.object_scanned_dlq.id

  redrive_allow_policy = jsonencode({
    redrivePermission = "byQueue",
    sourceQueueArns   = [aws_sqs_queue.object_scanned.arn]
  })
}

resource "aws_sqs_queue_policy" "object_scanned_queue_policy" {
  queue_url = aws_sqs_queue.object_scanned.id
  policy    = data.aws_iam_policy_document.object_scanned_queue_policy.json
}

data "aws_iam_policy_document" "object_scanned_queue_policy" {
  statement {
    effect  = "Allow"
    actions = ["SQS:SendMessage"]
    principals {
      type        = "Service"
      identifiers = ["events.amazonaws.com"]
    }
    resources = [aws_sqs_queue.object_scanned.arn]
    condition {
      test     = "ArnEquals"
      variable = "aws:SourceArn"
      values   = [aws_cloudwatch_event_rule.object_scanned_rule.arn]
    }
  }
}
