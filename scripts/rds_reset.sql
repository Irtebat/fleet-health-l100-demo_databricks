-- Undo rds_change.sql (for rehearsals). Then re-run the job to bring Databricks back in line.
UPDATE fleet.machines
SET customer_id = 8, region = 'East', dealer = 'Kolkata Dealer'
WHERE machine_id = 'EX-007';

UPDATE fleet.customers SET phone = '+91-98100-11001' WHERE customer_id = 1;

DELETE FROM fleet.customers WHERE customer_id = 11;

SELECT machine_id, region, dealer, customer_id, updated_at FROM fleet.machines WHERE machine_id = 'EX-007';
