#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_DIR"
export npm_config_cache="${npm_config_cache:-$REPO_DIR/.tools/npm-cache}"
export PATH="$REPO_DIR/.tools:$PATH"
MODE="${1:-check}"
if [[ $# -gt 0 ]]; then shift; fi

usage() {
  cat <<'HELP'
Aufruf: ./setup.sh [check|dev|build|tools|plan|deploy] [Terraform-Optionen]
  check    Dependencies installieren, BASIC-Tests und Produktionsbuild (Standard)
  dev      Lokalen Vite-Server starten
  build    Produktionsdateien nach dist bauen
  tools    Terraform 1.13.4 lokal mit SHA-256-Prüfung installieren
  plan     Build testen und AWS-Terraform-Plan nach infra/site.tfplan schreiben
  deploy   Build testen, Terraform anwenden, CloudFront-Cache leeren und HTTPS prüfen

Voraussetzungen: Node.js >=24.14; für plan/deploy AWS CLI v2.
Terraform wird bei Bedarf lokal installiert (unzip erforderlich).
AWS_PROFILE bzw. die normale AWS-Credential-Chain wird unverändert verwendet.
Die öffentliche Route-53-Zone rootpilot.de muss im AWS-Konto vorhanden sein.
Beispiel: AWS_PROFILE=rootpilot ./setup.sh deploy -var=aws_region=eu-central-1
Deployment erzeugt kostenpflichtige AWS-Ressourcen. Terraform zeigt den Plan
und fragt vor Änderungen nach Bestätigung. State liegt lokal unter infra/.
HELP
}

case "$MODE" in
  -h|--help|help) usage; exit 0 ;;
  check|dev|build|tools|plan|deploy) ;;
  *) usage >&2; exit 2 ;;
esac

command -v node >/dev/null || { echo 'Node.js >=24.14 fehlt.' >&2; exit 1; }
node --input-type=module -e 'const [major,minor]=process.versions.node.split(".").map(Number); if(major<24||(major===24&&minor<14)){console.error("Node.js >=24.14 erforderlich.");process.exit(1)}'
if [[ "$MODE" == tools ]]; then exec node scripts/install-terraform.mjs; fi
npm ci --ignore-scripts

if [[ "$MODE" == dev ]]; then exec npm run dev; fi
if [[ "$MODE" != build ]]; then npm test; fi
npm run build
if [[ "$MODE" == check || "$MODE" == build ]]; then exit 0; fi

if ! command -v terraform >/dev/null; then node scripts/install-terraform.mjs; fi
command -v aws >/dev/null || { echo 'AWS CLI v2 fehlt: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html' >&2; exit 1; }
# Check the existing credential chain without printing credentials or tokens.
aws sts get-caller-identity --query Account --output text >/dev/null
terraform -chdir=infra init -input=false
terraform -chdir=infra fmt -check
terraform -chdir=infra validate
terraform -chdir=infra plan -out=site.tfplan "$@"
if [[ "$MODE" == plan ]]; then exit 0; fi

printf '\nDen angezeigten AWS-Plan kostenpflichtig veröffentlichen? [yes/NEIN] '
read -r DEPLOY_CONFIRM
if [[ "$DEPLOY_CONFIRM" != yes ]]; then echo 'Veröffentlichung abgebrochen.'; exit 0; fi
terraform -chdir=infra apply site.tfplan
DISTRIBUTION_ID="$(terraform -chdir=infra output -raw distribution_id)"
SITE_URL="$(terraform -chdir=infra output -raw site_url)"
INVALIDATION_ID="$(aws cloudfront create-invalidation --distribution-id "$DISTRIBUTION_ID" --paths '/*' --query Invalidation.Id --output text)"
aws cloudfront wait invalidation-completed --distribution-id "$DISTRIBUTION_ID" --id "$INVALIDATION_ID"
NODE_USE_ENV_PROXY=1 node scripts/check-live.mjs "$SITE_URL"
printf '\nVeröffentlicht: %s\n' "$SITE_URL"
