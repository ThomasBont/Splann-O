DROP INDEX IF EXISTS event_settlement_rounds_one_active_per_event_idx;

CREATE UNIQUE INDEX IF NOT EXISTS event_settlement_rounds_one_active_final_per_event_idx
  ON event_settlement_rounds (event_id)
  WHERE status = 'active' AND round_type = 'balance_settlement';

CREATE UNIQUE INDEX IF NOT EXISTS event_settlement_rounds_one_active_quick_settle_per_event_idx
  ON event_settlement_rounds (event_id)
  WHERE status = 'active' AND round_type = 'direct_split';
