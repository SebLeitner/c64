mock_provider "aws" {
  mock_data "aws_caller_identity" {
    defaults = { account_id = "123456789012" }
  }
  mock_data "aws_route53_zone" {
    defaults = { zone_id = "Z1234567890", name = "rootpilot.de" }
  }
}

mock_provider "aws" {
  alias = "certificate"
  mock_resource "aws_acm_certificate" {
    defaults = {
      domain_validation_options = [{
        domain_name           = "c64.rootpilot.de"
        resource_record_name  = "_validation.c64.rootpilot.de"
        resource_record_type  = "CNAME"
        resource_record_value = "_validation.acm-validations.aws."
      }]
    }
  }
}

run "private_https_site" {
  command = plan
  assert {
    condition     = aws_s3_bucket_public_access_block.site.block_public_acls && aws_s3_bucket_public_access_block.site.block_public_policy && aws_s3_bucket_public_access_block.site.ignore_public_acls && aws_s3_bucket_public_access_block.site.restrict_public_buckets
    error_message = "S3 muss privat bleiben."
  }
  assert {
    condition     = aws_cloudfront_origin_access_control.site.signing_behavior == "always"
    error_message = "CloudFront muss S3-Anfragen signieren."
  }
  assert {
    condition     = aws_cloudfront_distribution.site.default_cache_behavior[0].viewer_protocol_policy == "redirect-to-https" && aws_cloudfront_distribution.site.viewer_certificate[0].minimum_protocol_version == "TLSv1.2_2021"
    error_message = "HTTPS und TLS 1.2 sind erforderlich."
  }
  assert {
    condition     = aws_route53_record.site["A"].name == "c64.rootpilot.de" && aws_route53_record.site["AAAA"].type == "AAAA"
    error_message = "IPv4 und IPv6 müssen auf die Zieldomain zeigen."
  }
  assert {
    condition     = aws_s3_object.site["index.html"].content_type == "text/html; charset=utf-8" && aws_s3_object.site["index.html"].cache_control == "no-cache, max-age=0, must-revalidate"
    error_message = "HTML braucht den korrekten MIME-Type und muss revalidiert werden."
  }
  assert {
    condition     = alltrue([for key, file in aws_s3_object.site : file.content_type == "application/wasm" if endswith(key, ".wasm")]) && length([for key in keys(aws_s3_object.site) : key if endswith(key, ".wasm")]) == 1
    error_message = "Der Emulator muss als WASM mit passendem MIME-Type ausgeliefert werden."
  }
}
