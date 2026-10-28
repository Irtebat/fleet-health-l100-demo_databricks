"""Creates (or updates) the Unity Catalog connection to the RDS fleet database.

The password is read from the UC secret <catalog>.secrets.rds_lfc_password,
so it never appears in code, bundle config or job parameters.
"""
import sys

from databricks.sdk import WorkspaceClient
from databricks.sdk.errors import NotFound
from databricks.sdk.runtime import dbutils
from databricks.sdk.service.catalog import ConnectionType

catalog, host, connection_name = sys.argv[1:4]

password = dbutils.secrets.get(catalog=catalog, schema="secrets", key="rds_lfc_password")
options = {"host": host, "port": "5432", "user": "lfc_reader", "password": password}

w = WorkspaceClient()
try:
    w.connections.get(connection_name)
    w.connections.update(name=connection_name, options=options)
    print(f"Updated connection {connection_name}")
except NotFound:
    w.connections.create(
        name=connection_name,
        connection_type=ConnectionType.POSTGRESQL,
        options=options,
        comment="Fleet demo - RDS PostgreSQL fleet database (read-only user)",
    )
    print(f"Created connection {connection_name}")
