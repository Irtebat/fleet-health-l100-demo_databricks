#!/usr/bin/env bash
# Allows port 5432 on the RDS security group from this laptop and from Databricks
# serverless egress IPs (us-east-2). Safe to re-run; also use it when your laptop IP changes.
# Usage: ./scripts/rds_allow_ips.sh [security-group-id]
set -euo pipefail

PROFILE=aws-sandbox-field-eng_databricks-sandbox-admin
REGION=us-east-2
aws() { command aws --profile "$PROFILE" --region "$REGION" "$@"; }

SG_ID=${1:-$(aws ec2 describe-security-groups --filters Name=group-name,Values=fleet-db-sg \
  --query 'SecurityGroups[0].GroupId' --output text)}

MY_IP="$(curl -s https://checkip.amazonaws.com)/32"
DATABRICKS_IPS=$(curl -s https://www.databricks.com/networking/v1/ip-ranges.json | python3 -c "
import json, sys
for p in json.load(sys.stdin)['prefixes']:
    if p['platform'] == 'aws' and p['region'] == '$REGION' and p['type'] == 'outbound':
        print(' '.join(p['ipv4Prefixes']))")

for cidr in $MY_IP $DATABRICKS_IPS; do
  aws ec2 authorize-security-group-ingress --group-id "$SG_ID" --protocol tcp --port 5432 --cidr "$cidr" \
    >/dev/null 2>&1 && echo "allowed $cidr" || echo "already allowed (or failed) $cidr"
done
