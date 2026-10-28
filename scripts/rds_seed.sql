-- Seeds the operational "fleet" database (mock data).
-- Usage: psql "host=<endpoint> dbname=fleetdb user=fleet_admin sslmode=require" \
--          -v lfc_password='<password-for-connector>' -f scripts/rds_seed.sql

CREATE SCHEMA IF NOT EXISTS fleet;

CREATE TABLE fleet.customers (
  customer_id   INT PRIMARY KEY,
  customer_name TEXT NOT NULL,
  phone         TEXT,
  city          TEXT,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE fleet.machines (
  machine_id      TEXT PRIMARY KEY,
  model           TEXT NOT NULL,
  region          TEXT NOT NULL,
  dealer          TEXT NOT NULL,
  customer_id     INT REFERENCES fleet.customers,
  commissioned_on DATE,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Keep updated_at current on every UPDATE: Lakeflow Connect uses it as the cursor
-- to pick up only changed rows.
CREATE FUNCTION fleet.touch_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER customers_touch BEFORE UPDATE ON fleet.customers
  FOR EACH ROW EXECUTE FUNCTION fleet.touch_updated_at();
CREATE TRIGGER machines_touch BEFORE UPDATE ON fleet.machines
  FOR EACH ROW EXECUTE FUNCTION fleet.touch_updated_at();

CREATE INDEX ON fleet.customers (updated_at);
CREATE INDEX ON fleet.machines (updated_at);

-- 10 customers
INSERT INTO fleet.customers (customer_id, customer_name, phone, city) VALUES
  (1,  'Sharma Infra Projects',     '+91-98100-11001', 'Delhi'),
  (2,  'Patel Earthmovers',         '+91-98250-22002', 'Ahmedabad'),
  (3,  'Reddy Constructions',       '+91-98490-33003', 'Hyderabad'),
  (4,  'Iyer Mining Services',      '+91-98400-44004', 'Chennai'),
  (5,  'Banerjee Roadworks',        '+91-98300-55005', 'Kolkata'),
  (6,  'Singh Highways',            '+91-98150-66006', 'Chandigarh'),
  (7,  'Deshmukh Builders',         '+91-98220-77007', 'Pune'),
  (8,  'Nair Port Logistics',       '+91-98470-88008', 'Kochi'),
  (9,  'Das Quarry Works',          '+91-98610-99009', 'Bhubaneswar'),
  (10, 'Gupta Urban Developers',    '+91-98290-10010', 'Jaipur');

-- 50 machines, spread across 4 regions
INSERT INTO fleet.machines (machine_id, model, region, dealer, customer_id, commissioned_on)
SELECT
  'EX-' || lpad(i::text, 3, '0'),
  (ARRAY['XC 200', 'XC 210 Plus', 'XC 130 Plus', 'XC 70 Compact', 'XC 220 Pro'])[1 + i % 5],
  (ARRAY['North', 'West', 'South', 'East'])[1 + i % 4],
  (ARRAY['Delhi Dealer', 'Mumbai Dealer', 'Chennai Dealer', 'Kolkata Dealer'])[1 + i % 4],
  1 + i % 10,
  DATE '2022-01-01' + (i * 17)
FROM generate_series(1, 50) AS i;

-- Read-only user for the Lakeflow Connect connector
CREATE USER lfc_reader WITH PASSWORD :'lfc_password';
GRANT USAGE ON SCHEMA fleet TO lfc_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA fleet TO lfc_reader;

SELECT region, count(*) AS machines FROM fleet.machines GROUP BY region ORDER BY region;
