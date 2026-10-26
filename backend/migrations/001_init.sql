-- Saker Energy initial schema
-- Run on container first start

CREATE EXTENSION IF NOT EXISTS timescaledb;
CREATE EXTENSION IF NOT EXISTS vector;

-- ============ Devices ============
CREATE TABLE devices (
    device_id      VARCHAR(64) PRIMARY KEY,
    tenant_id      VARCHAR(64) NOT NULL DEFAULT 'default',
    site_id        VARCHAR(64) NOT NULL DEFAULT 'main',
    device_type    VARCHAR(32) NOT NULL,  -- charger | pcs | battery_cabinet | meter | transformer
    model          VARCHAR(64),
    rated_power_kw NUMERIC(10,2),
    topology_group VARCHAR(64),          -- electrical bus group
    installed_at   TIMESTAMPTZ DEFAULT NOW(),
    is_active      BOOLEAN DEFAULT TRUE
);

-- ============ Telemetry (TimescaleDB hypertable) ============
CREATE TABLE telemetry (
    time          TIMESTAMPTZ       NOT NULL,
    tenant_id     VARCHAR(64)       NOT NULL DEFAULT 'default',
    site_id       VARCHAR(64)       NOT NULL DEFAULT 'main',
    device_id     VARCHAR(64)       NOT NULL,
    point         VARCHAR(64)       NOT NULL,  -- temperature, voltage, current, power, soc, fan_speed...
    unit          VARCHAR(16)       NOT NULL,
    value         DOUBLE PRECISION  NOT NULL,
    quality       SMALLINT          NOT NULL DEFAULT 0,  -- 0=good,1=uncertain,2=bad
    source        VARCHAR(32)       NOT NULL DEFAULT 'sim',  -- sim | real
    trace_id      VARCHAR(64)
);

SELECT create_hypertable('telemetry', 'time', if_not_exists => TRUE);
CREATE INDEX idx_telemetry_device_time ON telemetry (device_id, time DESC);
CREATE INDEX idx_telemetry_point_time ON telemetry (point, time DESC);

-- ============ Alarms (raw per-device alarms) ============
CREATE TABLE alarms (
    alarm_id     SERIAL PRIMARY KEY,
    event_id     INTEGER,
    device_id    VARCHAR(64) NOT NULL,
    alarm_code   VARCHAR(64) NOT NULL,
    severity     SMALLINT    NOT NULL DEFAULT 2,  -- 1=info,2=warning,3=critical
    observed_at  TIMESTAMPTZ NOT NULL,
    message      TEXT,
    raw_ref      VARCHAR(256),
    acknowledged BOOLEAN DEFAULT FALSE,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_alarms_device ON alarms (device_id, observed_at DESC);
CREATE INDEX idx_alarms_event ON alarms (event_id);

-- ============ Events (correlated multi-device events) ============
CREATE TABLE events (
    event_id        SERIAL PRIMARY KEY,
    site_id         VARCHAR(64) NOT NULL DEFAULT 'main',
    event_type      VARCHAR(64) NOT NULL,  -- thermal_anomaly | temp_spread | grid_disturbance | comm_loss...
    first_seen      TIMESTAMPTZ NOT NULL,
    last_seen       TIMESTAMPTZ NOT NULL,
    affected_devices JSONB NOT NULL DEFAULT '[]',
    status          VARCHAR(32) NOT NULL DEFAULT 'OPEN',  -- OPEN | TRIAGED | INVESTIGATING | AWAITING_HUMAN | RESOLVED | REOPENED
    root_cause      VARCHAR(256),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_events_status ON events (status, first_seen DESC);

-- ============ Diagnoses ============
CREATE TABLE diagnoses (
    diagnosis_id   SERIAL PRIMARY KEY,
    event_id       INTEGER NOT NULL REFERENCES events(event_id),
    hypotheses     JSONB NOT NULL,  -- [{cause, rank, support, against}]
    next_checks    JSONB,
    abstain        BOOLEAN DEFAULT FALSE,
    model_version   VARCHAR(64),
    knowledge_version VARCHAR(64),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============ Work Orders ============
CREATE TABLE work_orders (
    wo_id         SERIAL PRIMARY KEY,
    event_id      INTEGER NOT NULL REFERENCES events(event_id),
    status        VARCHAR(32) NOT NULL DEFAULT 'NEW',
    assignee      VARCHAR(64),
    approval_by   VARCHAR(64),
    checks        JSONB,
    feedback_refs  JSONB,
    created_at     TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW(),
    closed_at     TIMESTAMPTZ
);
CREATE INDEX idx_wo_status ON work_orders (status);

-- ============ Audit Log ============
CREATE TABLE audit_log (
    audit_id    SERIAL PRIMARY KEY,
    trace_id   VARCHAR(64),
    actor      VARCHAR(64) NOT NULL,
    action     VARCHAR(128) NOT NULL,
    target     VARCHAR(128),
    detail     JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_audit_trace ON audit_log (trace_id);

-- ============ Knowledge Base (vector search) ============
CREATE TABLE knowledge_base (
    kb_id      SERIAL PRIMARY KEY,
    doc_type   VARCHAR(64) NOT NULL,  -- manual | fault_tree | checklist
    title      VARCHAR(256) NOT NULL,
    content    TEXT NOT NULL,
    embedding  VECTOR(1536),
    version    VARCHAR(32),
    source     VARCHAR(256),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============ Seed devices: 12 chargers + 1 BESS + 1 PCS + 1 meter ============
INSERT INTO devices (device_id, device_type, model, rated_power_kw, topology_group) VALUES
('CP-01', 'charger', 'DC-120kW', 120, 'BUS-A'),
('CP-02', 'charger', 'DC-120kW', 120, 'BUS-A'),
('CP-03', 'charger', 'DC-120kW', 120, 'BUS-A'),
('CP-04', 'charger', 'DC-120kW', 120, 'BUS-A'),
('CP-05', 'charger', 'DC-120kW', 120, 'BUS-B'),
('CP-06', 'charger', 'DC-120kW', 120, 'BUS-B'),
('CP-07', 'charger', 'DC-120kW', 120, 'BUS-B'),
('CP-08', 'charger', 'DC-120kW', 120, 'BUS-B'),
('CP-09', 'charger', 'DC-120kW', 120, 'BUS-C'),
('CP-10', 'charger', 'DC-120kW', 120, 'BUS-C'),
('CP-11', 'charger', 'DC-120kW', 120, 'BUS-C'),
('CP-12', 'charger', 'DC-120kW', 120, 'BUS-C'),
('BESS-01', 'battery_cabinet', 'LFP-1MWh', 500, 'BUS-B'),
('PCS-01', 'pcs', 'PCS-500kW', 500, 'BUS-B'),
('METER-01', 'meter', 'Grid-Meter', NULL, 'GRID');
