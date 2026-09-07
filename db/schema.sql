-- ============================================================
-- Insurance Policy & Accounting Module - Schema
-- Insert-only architecture: business/financial tables are
-- never UPDATEd or DELETEd from application code.
-- ============================================================

CREATE DATABASE IF NOT EXISTS insurance_module;
USE insurance_module;

-- ------------------------------------------------------------
-- customers
-- ------------------------------------------------------------
CREATE TABLE customers (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(150) NOT NULL,
  email       VARCHAR(150) NOT NULL,
  phone       VARCHAR(20),
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_customers_email (email)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- policies
-- ------------------------------------------------------------
CREATE TABLE policies (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  policy_number   VARCHAR(50) NOT NULL,
  customer_id     INT NOT NULL,
  premium_amount  DECIMAL(12,2) NOT NULL,
  gst_rate        DECIMAL(5,2) NOT NULL DEFAULT 18.00,
  gst_amount      DECIMAL(12,2) NOT NULL,
  total_premium   DECIMAL(12,2) NOT NULL,
  status          ENUM('ACTIVE','CANCELLED') NOT NULL DEFAULT 'ACTIVE',
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_policy_number UNIQUE (policy_number),
  CONSTRAINT fk_policies_customer FOREIGN KEY (customer_id)
    REFERENCES customers(id),
  INDEX idx_policies_customer (customer_id)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- policy_transactions
-- Audit trail of policy-level lifecycle events (insert-only)
-- ------------------------------------------------------------
CREATE TABLE policy_transactions (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  policy_id         INT NOT NULL,
  transaction_type  ENUM('CREATED','ENDORSED','CANCELLED') NOT NULL,
  amount            DECIMAL(12,2) NOT NULL,
  remarks           VARCHAR(255),
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_policytxn_policy FOREIGN KEY (policy_id)
    REFERENCES policies(id),
  INDEX idx_policytxn_policy (policy_id)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- payments (insert-only; corrections are new rows)
-- ------------------------------------------------------------
CREATE TABLE payments (
  id                    INT AUTO_INCREMENT PRIMARY KEY,
  policy_id             INT NOT NULL,
  amount                DECIMAL(12,2) NOT NULL,
  payment_type          ENUM('PAYMENT','REVERSAL') NOT NULL DEFAULT 'PAYMENT',
  reference_payment_id  INT NULL,
  remarks               VARCHAR(255),
  created_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_payments_policy FOREIGN KEY (policy_id)
    REFERENCES policies(id),
  CONSTRAINT fk_payments_reference FOREIGN KEY (reference_payment_id)
    REFERENCES payments(id),
  INDEX idx_payments_policy (policy_id)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- accounts (chart of accounts - master/reference data)
-- ------------------------------------------------------------
CREATE TABLE accounts (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  account_name  VARCHAR(100) NOT NULL,
  account_type  ENUM('ASSET','LIABILITY','INCOME','EXPENSE') NOT NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_account_name UNIQUE (account_name)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- ledger_entries (double-entry bookkeeping, insert-only)
-- ------------------------------------------------------------
CREATE TABLE ledger_entries (
  id                      INT AUTO_INCREMENT PRIMARY KEY,
  policy_id               INT NOT NULL,
  transaction_reference   VARCHAR(80) NOT NULL,
  account_id              INT NOT NULL,
  debit                   DECIMAL(12,2) NOT NULL DEFAULT 0,
  credit                  DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ledger_policy FOREIGN KEY (policy_id)
    REFERENCES policies(id),
  CONSTRAINT fk_ledger_account FOREIGN KEY (account_id)
    REFERENCES accounts(id),
  INDEX idx_ledger_policy (policy_id),
  INDEX idx_ledger_txnref (transaction_reference),
  INDEX idx_ledger_account (account_id)
) ENGINE=InnoDB;
