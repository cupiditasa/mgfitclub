-- Link coach workout/nutrition requests to cash orders; retain the service request lifecycle.
ALTER TABLE coach_service_requests ADD COLUMN payment_method TEXT CHECK(payment_method IN ('cash','online'));
ALTER TABLE coach_service_requests ADD COLUMN cash_amount_toman INTEGER CHECK(cash_amount_toman IS NULL OR cash_amount_toman >= 0);
ALTER TABLE coach_service_requests ADD COLUMN order_id TEXT REFERENCES orders(id);
CREATE UNIQUE INDEX IF NOT EXISTS coach_request_order_unique ON coach_service_requests(order_id) WHERE order_id IS NOT NULL;
