#!/usr/bin/env bash
# Deletes the demo RDS instance and its security group.
set -euo pipefail

PROFILE=aws-sandbox-field-eng_databricks-sandbox-admin
REGION=us-east-2
DB_ID=fleet-db

aws() { command aws --profile "$PROFILE" --region "$REGION" "$@"; }

aws rds delete-db-instance --db-instance-identifier "$DB_ID" --skip-final-snapshot >/dev/null
aws rds wait db-instance-deleted --db-instance-identifier "$DB_ID"

SG_ID=$(aws ec2 describe-security-groups --filters Name=group-name,Values="$DB_ID-sg" \
  --query 'SecurityGroups[0].GroupId' --output text)
aws ec2 delete-security-group --group-id "$SG_ID"
echo "Deleted $DB_ID and $SG_ID"
