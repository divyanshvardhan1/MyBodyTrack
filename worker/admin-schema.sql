-- Additive migration. Existing device, usage and quote records remain unchanged.
CREATE TABLE IF NOT EXISTS admin_accounts (uid TEXT PRIMARY KEY, first_seen TEXT NOT NULL, last_seen TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS admin_activity (day TEXT NOT NULL, uid TEXT NOT NULL, PRIMARY KEY(day,uid));
CREATE TABLE IF NOT EXISTS admin_metrics (day TEXT NOT NULL, metric TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(day,metric));
CREATE TABLE IF NOT EXISTS admin_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
INSERT OR IGNORE INTO admin_meta VALUES ('started',datetime('now'));
INSERT OR IGNORE INTO admin_accounts SELECT DISTINCT uid,date('now'),date('now') FROM devices;
INSERT OR IGNORE INTO admin_accounts SELECT DISTINCT substr(scope,6),date('now'),date('now') FROM usage WHERE scope LIKE 'user:%';
