USE insurance_module;

-- Chart of accounts (master data, seeded once)
INSERT INTO accounts (account_name, account_type) VALUES
  ('Customer Receivable', 'ASSET'),
  ('Premium Income', 'INCOME'),
  ('GST Payable', 'LIABILITY'),
  ('Bank/Cash', 'ASSET');

-- Sample customers
INSERT INTO customers (name, email, phone) VALUES
  ('Rahul Sharma', 'rahul.sharma@example.com', '9876543210'),
  ('Priya Verma', 'priya.verma@example.com', '9123456780');

-- Sample policy (Premium 10,000 -> GST 18% -> Total 11,800)
-- created purely as reference data; in real flow this row is
-- produced by POST /policies, not inserted directly like this.
INSERT INTO policies (policy_number, customer_id, premium_amount, gst_rate, gst_amount, total_premium, status)
VALUES ('POL-0001', 1, 10000.00, 18.00, 1800.00, 11800.00, 'ACTIVE');

INSERT INTO policy_transactions (policy_id, transaction_type, amount, remarks)
VALUES (1, 'CREATED', 11800.00, 'Initial policy issuance');

INSERT INTO ledger_entries (policy_id, transaction_reference, account_id, debit, credit) VALUES
  (1, 'POLICY-1-CREATE', (SELECT id FROM accounts WHERE account_name='Customer Receivable'), 11800.00, 0),
  (1, 'POLICY-1-CREATE', (SELECT id FROM accounts WHERE account_name='Premium Income'),       0, 10000.00),
  (1, 'POLICY-1-CREATE', (SELECT id FROM accounts WHERE account_name='GST Payable'),          0, 1800.00);
