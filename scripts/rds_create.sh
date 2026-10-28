#!/usr/bin/env bash
# Creates a small, PUBLIC PostgreSQL RDS instance for the demo (delete it afterwards: rds_delete.sh).
# Usage: DB_PASSWORD='<strong-password>' ./scripts/rds_create.sh
set -euo pipefail

PROFILE=aws-sandbox-field-eng_databricks-sandbox-admin
REGION=us-east-2                      # same region as the Databricks workspace
DB_ID=fleet-db
TAGS="Key=project,Value=fleet-l100 Key=customer,Value=demo-customer Key=env,Value=demo Key=owner,Value=<your-name>"
: "${DB_PASSWORD:?Set DB_PASSWORD}"

aws() { command aws --profile "$PROFILE" --region "$REGION" "$@"; }

# 1. Security group in the default VPC, open on 5432 to:
#    - this laptop's public IP (for psql)
#    - Databricks published outbound IPs for us-east-2 (serverless egress), from
#      https://www.databricks.com/networking/v1/ip-ranges.json
#    (0.0.0.0/0 is auto-removed by the sandbox's Cloud Custodian guardrail.)
VPC_ID=$(aws ec2 describe-vpcs --filters Name=is-default,Values=true --query 'Vpcs[0].VpcId' --output text)
SG_ID=$(aws ec2 create-security-group --group-name "$DB_ID-sg" --vpc-id "$VPC_ID" \
  --description "Fleet demo RDS - 5432 from laptop + Databricks" \
  --tag-specifications "ResourceType=security-group,Tags=[{Key=project,Value=fleet-l100}]" \
  --query GroupId --output text)
"$(dirname "$0")/rds_allow_ips.sh" "$SG_ID"

# 2. Smallest PostgreSQL instance, no backups, no Multi-AZ.
aws rds create-db-instance \
  --db-instance-identifier "$DB_ID" \
  --engine postgres \
  --db-instance-class db.t4g.micro \
  --allocated-storage 20 --storage-type gp3 \
  --master-username fleet_admin \
  --master-user-password "$DB_PASSWORD" \
  --db-name fleetdb \
  --vpc-security-group-ids "$SG_ID" \
  --publicly-accessible \
  --backup-retention-period 0 \
  --no-multi-az \
  --tags $TAGS >/dev/null

echo "Waiting for $DB_ID to become available (~5-10 min)..."
aws rds wait db-instance-available --db-instance-identifier "$DB_ID"

aws rds describe-db-instances --db-instance-identifier "$DB_ID" \
  --query 'DBInstances[0].Endpoint.Address' --output text
