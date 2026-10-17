variable "aws_region" {
  description = "Region für den privaten S3-Bucket. CloudFront-Zertifikate liegen in us-east-1."
  type        = string
  default     = "eu-central-1"
}

variable "domain_name" {
  type    = string
  default = "c64.rootpilot.de"
  validation {
    condition     = can(regex("^[a-z0-9][a-z0-9.-]+[a-z0-9]$", var.domain_name))
    error_message = "domain_name muss ein DNS-Hostname ohne Protokoll oder Pfad sein."
  }
}

variable "zone_name" {
  description = "Bereits vorhandene öffentliche Route-53-Zone; wird nicht neu angelegt."
  type        = string
  default     = "rootpilot.de"
}

variable "site_directory" {
  description = "Verzeichnis des bereits gebauten Vite-Frontends, relativ zu infra."
  type        = string
  default     = "../dist"
  validation {
    condition     = fileexists("${var.site_directory}/index.html")
    error_message = "Frontend fehlt. Zuerst npm ci und npm run build im Repository ausführen."
  }
}
