-- Live demo moment: change the operational data, then re-run the job and
-- watch the change flow to bronze → gold → dashboard → Lakebase → app.
-- Usage: psql "host=<endpoint> dbname=fleetdb user=fleet_admin sslmode=require" -f scripts/rds_change.sql

-- A new customer buys a machine...
INSERT INTO fleet.customers (customer_id, customer_name, phone, city)
VALUES (11, 'Metro Projects Demo Site', '+91-98000-11011', 'Mumbai')
ON CONFLICT (customer_id) DO NOTHING;   -- safe to re-run

-- ...EX-007 (one of the "hot" machines) is moved to that customer and a new region/dealer
UPDATE fleet.machines
SET customer_id = 11, region = 'West', dealer = 'Mumbai Dealer'
WHERE machine_id = 'EX-007';

-- A customer updates their phone number (PII column, masked by ABAC downstream)
UPDATE fleet.customers SET phone = '+91-98100-99999' WHERE customer_id = 1;

SELECT machine_id, region, dealer, customer_id, updated_at
FROM fleet.machines WHERE machine_id = 'EX-007';
