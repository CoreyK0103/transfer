resource "aws_guardduty_malware_protection_plan" "malware_protection" {
  role = aws_iam_role.guardduty_role.arn

  protected_resource {
    s3_bucket {
      bucket_name     = module.landing_bucket.s3_bucket_id
      object_prefixes = ["uploads"]
    }
  }

  tags = {
    Environment = var.environment
  }
}

resource "aws_iam_role" "guardduty_role" {
  name = "${local.resource_prefix}-guardduty-role"

  assume_role_policy = data.aws_iam_policy_document.guardduty_trust_policy.json

  tags = {
    Environment = var.environment
  }
}

resource "aws_iam_role_policy" "guardduty_role" {
  role   = aws_iam_role.guardduty_role.id
  policy = data.aws_iam_policy_document.malware_protection.json
}

data "aws_iam_policy_document" "guardduty_trust_policy" {
  statement {
    actions = ["sts:AssumeRole"]
    effect  = "Allow"
    principals {
      type        = "Service"
      identifiers = ["malware-protection-plan.guardduty.amazonaws.com"]
    }
  }
}

data "aws_iam_policy_document" "malware_protection" {
  statement {
    sid       = "AllowManagedRuleToSendS3EventsToGuardDuty"
    effect    = "Allow"
    resources = ["arn:aws:events:${var.region}:${var.account_id}:rule/DO-NOT-DELETE-AmazonGuardDutyMalwareProtectionS3*"]

    actions = [
      "events:PutRule",
      "events:DeleteRule",
      "events:PutTargets",
      "events:RemoveTargets",
    ]

    condition {
      test     = "StringLike"
      variable = "events:ManagedBy"
      values   = ["malware-protection-plan.guardduty.amazonaws.com"]
    }
  }

  statement {
    sid       = "AllowGuardDutyToMonitorEventBridgeManagedRule"
    effect    = "Allow"
    resources = ["arn:aws:events:${var.region}:${var.account_id}:rule/DO-NOT-DELETE-AmazonGuardDutyMalwareProtectionS3*"]

    actions = [
      "events:DescribeRule",
      "events:ListTargetsByRule",
    ]
  }

  statement {
    sid       = "AllowEnableS3EventBridgeEvents"
    effect    = "Allow"
    resources = ["${module.landing_bucket.s3_bucket_arn}"]

    actions = [
      "s3:PutBucketNotification",
      "s3:GetBucketNotification",
    ]
  }

  statement {
    sid       = "AllowPutValidationObject"
    effect    = "Allow"
    resources = ["${module.landing_bucket.s3_bucket_arn}/malware-protection-resource-validation-object"]
    actions   = ["s3:PutObject"]
  }

  statement {
    sid       = "AllowCheckBucketOwnership"
    effect    = "Allow"
    resources = ["${module.landing_bucket.s3_bucket_arn}"]
    actions   = ["s3:ListBucket"]
  }

  statement {
    sid       = "AllowMalwareScan"
    effect    = "Allow"
    resources = ["${module.landing_bucket.s3_bucket_arn}/*"]

    actions = [
      "s3:GetObject",
      "s3:GetObjectVersion",
    ]
  }
}
