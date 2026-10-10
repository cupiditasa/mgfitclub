-- Canonical MG membership catalog, cash-request review, active entitlements and device visit usage.
ALTER TABLE membership_plans ADD COLUMN plan_key TEXT;
ALTER TABLE membership_plans ADD COLUMN session_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE membership_plans ADD COLUMN category TEXT NOT NULL DEFAULT 'membership';
CREATE UNIQUE INDEX membership_plans_plan_key ON membership_plans(plan_key) WHERE plan_key IS NOT NULL;

ALTER TABLE orders ADD COLUMN payment_method TEXT NOT NULL DEFAULT 'online' CHECK(payment_method IN ('cash','online'));
ALTER TABLE membership_requests ADD COLUMN club_id TEXT REFERENCES clubs(id);
ALTER TABLE membership_requests ADD COLUMN first_name_snapshot TEXT;
ALTER TABLE membership_requests ADD COLUMN last_name_snapshot TEXT;
ALTER TABLE membership_requests ADD COLUMN phone_snapshot TEXT;
ALTER TABLE membership_requests ADD COLUMN avatar_data_snapshot TEXT;
ALTER TABLE membership_requests ADD COLUMN idempotency_key TEXT;
CREATE UNIQUE INDEX membership_requests_idempotency ON membership_requests(user_id,idempotency_key) WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS memberships (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  club_id TEXT NOT NULL REFERENCES clubs(id),
  plan_id TEXT NOT NULL REFERENCES membership_plans(id),
  order_id TEXT NOT NULL UNIQUE REFERENCES orders(id),
  starts_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  sessions_total INTEGER NOT NULL CHECK(sessions_total > 0),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','cancelled')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS memberships_user_active ON memberships(user_id,status,expires_at);
CREATE TABLE IF NOT EXISTS membership_visits (
  id TEXT PRIMARY KEY,
  membership_id TEXT NOT NULL REFERENCES memberships(id),
  event_id TEXT NOT NULL UNIQUE REFERENCES mg_bridge_events(id),
  business_day TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(membership_id,business_day)
);
CREATE TRIGGER IF NOT EXISTS membership_visit_guard BEFORE INSERT ON membership_visits
WHEN NOT EXISTS (
  SELECT 1 FROM memberships s JOIN mg_bridge_events e ON e.id=NEW.event_id
  JOIN mg_bridge_members m ON m.bridge_id=e.bridge_id AND m.member_id=e.member_id AND m.user_id=s.user_id
  JOIN mg_bridges b ON b.id=e.bridge_id AND b.club_id=s.club_id
  JOIN users u ON u.id=s.user_id
  WHERE s.id=NEW.membership_id AND s.status='active' AND e.state='approved'
    AND e.business_day=NEW.business_day AND u.status='active'
    AND e.occurred_at>=s.starts_at AND e.occurred_at<s.expires_at
    AND (SELECT count(*) FROM membership_visits v WHERE v.membership_id=s.id)<s.sessions_total
)
BEGIN SELECT RAISE(ABORT,'membership_visit_not_allowed'); END;

-- Website membership card prices are displayed in toman; API/order amounts are stored in rial.
INSERT OR IGNORE INTO membership_plans(id,title,description,duration_days,schedule_type,price,is_active,plan_key,session_count,category) VALUES
('mg_basic_12_30','عمومی Basic · ۱۲ جلسه · یک‌ماهه','۳,۵۰۰,۰۰۰ تومان',30,'general',35000000,1,'basic_12_30',12,'basic'),
('mg_basic_16_30','عمومی Basic · ۱۶ جلسه · یک‌ماهه','۴,۰۰۰,۰۰۰ تومان',30,'general',40000000,1,'basic_16_30',16,'basic'),
('mg_basic_24_30','عمومی Basic · ۲۴ جلسه · یک‌ماهه','۴,۵۰۰,۰۰۰ تومان',30,'general',45000000,1,'basic_24_30',24,'basic'),
('mg_plus_8_30','نیمه‌خصوصی Plus · ۸ جلسه · یک‌ماهه','۴,۵۰۰,۰۰۰ تومان',30,'semi_private',45000000,1,'plus_8_30',8,'plus'),
('mg_plus_10_30','نیمه‌خصوصی Plus · ۱۰ جلسه · یک‌ماهه','۵,۰۰۰,۰۰۰ تومان',30,'semi_private',50000000,1,'plus_10_30',10,'plus'),
('mg_plus_12_30','نیمه‌خصوصی Plus · ۱۲ جلسه · یک‌ماهه','۵,۵۰۰,۰۰۰ تومان',30,'semi_private',55000000,1,'plus_12_30',12,'plus'),
('mg_plus_16_30','نیمه‌خصوصی Plus · ۱۶ جلسه · یک‌ماهه','۶,۵۰۰,۰۰۰ تومان',30,'semi_private',65000000,1,'plus_16_30',16,'plus'),
('mg_plus_24_30','نیمه‌خصوصی Plus · ۲۴ جلسه · یک‌ماهه','۸,۰۰۰,۰۰۰ تومان',30,'semi_private',80000000,1,'plus_24_30',24,'plus'),
('mg_pro_8_30','خصوصی Pro · ۸ جلسه · یک‌ماهه','۵,۵۰۰,۰۰۰ تومان',30,'private',55000000,1,'pro_8_30',8,'pro'),
('mg_pro_10_30','خصوصی Pro · ۱۰ جلسه · یک‌ماهه','۶,۰۰۰,۰۰۰ تومان',30,'private',60000000,1,'pro_10_30',10,'pro'),
('mg_pro_12_30','خصوصی Pro · ۱۲ جلسه · یک‌ماهه','۶,۵۰۰,۰۰۰ تومان',30,'private',65000000,1,'pro_12_30',12,'pro'),
('mg_pro_16_30','خصوصی Pro · ۱۶ جلسه · یک‌ماهه','۷,۵۰۰,۰۰۰ تومان',30,'private',75000000,1,'pro_16_30',16,'pro'),
('mg_pro_24_30','خصوصی Pro · ۲۴ جلسه · یک‌ماهه','۹,۵۰۰,۰۰۰ تومان',30,'private',95000000,1,'pro_24_30',24,'pro'),
('mg_vip_8_30','VIP اختصاصی · ۸ جلسه · یک‌ماهه','۶,۵۰۰,۰۰۰ تومان',30,'vip',65000000,1,'vip_8_30',8,'vip'),
('mg_vip_10_30','VIP اختصاصی · ۱۰ جلسه · یک‌ماهه','۷,۵۰۰,۰۰۰ تومان',30,'vip',75000000,1,'vip_10_30',10,'vip'),
('mg_vip_12_30','VIP اختصاصی · ۱۲ جلسه · یک‌ماهه','۸,۵۰۰,۰۰۰ تومان',30,'vip',85000000,1,'vip_12_30',12,'vip'),
('mg_ems_12_30','EMS · ۱۲ جلسه','۷,۵۰۰,۰۰۰ تومان',30,'ems',75000000,1,'ems_12_30',12,'special'),
('mg_corrective_12_30','اصلاحی · ۱۲ جلسه · یک‌ماهه','۸,۵۰۰,۰۰۰ تومان',30,'corrective',85000000,1,'corrective_12_30',12,'special'),
('mg_basic_12_90','عمومی Basic · ۳۶ جلسه · سه‌ماهه','۸,۹۲۵,۰۰۰ تومان',90,'general',89250000,1,'basic_12_90',36,'basic'),
('mg_basic_16_90','عمومی Basic · ۴۸ جلسه · سه‌ماهه','۱۰,۲۰۰,۰۰۰ تومان',90,'general',102000000,1,'basic_16_90',48,'basic'),
('mg_basic_24_90','عمومی Basic · ۷۲ جلسه · سه‌ماهه','۱۱,۴۷۵,۰۰۰ تومان',90,'general',114750000,1,'basic_24_90',72,'basic'),
('mg_plus_8_90','نیمه‌خصوصی Plus · ۲۴ جلسه · سه‌ماهه','۱۱,۴۷۵,۰۰۰ تومان',90,'semi_private',114750000,1,'plus_8_90',24,'plus'),
('mg_plus_10_90','نیمه‌خصوصی Plus · ۳۰ جلسه · سه‌ماهه','۱۲,۷۵۰,۰۰۰ تومان',90,'semi_private',127500000,1,'plus_10_90',30,'plus'),
('mg_plus_12_90','نیمه‌خصوصی Plus · ۳۶ جلسه · سه‌ماهه','۱۴,۰۲۵,۰۰۰ تومان',90,'semi_private',140250000,1,'plus_12_90',36,'plus'),
('mg_plus_16_90','نیمه‌خصوصی Plus · ۴۸ جلسه · سه‌ماهه','۱۶,۵۷۵,۰۰۰ تومان',90,'semi_private',165750000,1,'plus_16_90',48,'plus'),
('mg_plus_24_90','نیمه‌خصوصی Plus · ۷۲ جلسه · سه‌ماهه','۲۰,۴۰۰,۰۰۰ تومان',90,'semi_private',204000000,1,'plus_24_90',72,'plus'),
('mg_pro_8_90','خصوصی Pro · ۲۴ جلسه · سه‌ماهه','۱۴,۰۲۵,۰۰۰ تومان',90,'private',140250000,1,'pro_8_90',24,'pro'),
('mg_pro_10_90','خصوصی Pro · ۳۰ جلسه · سه‌ماهه','۱۵,۳۰۰,۰۰۰ تومان',90,'private',153000000,1,'pro_10_90',30,'pro'),
('mg_pro_12_90','خصوصی Pro · ۳۶ جلسه · سه‌ماهه','۱۶,۵۷۵,۰۰۰ تومان',90,'private',165750000,1,'pro_12_90',36,'pro'),
('mg_pro_16_90','خصوصی Pro · ۴۸ جلسه · سه‌ماهه','۱۹,۱۲۵,۰۰۰ تومان',90,'private',191250000,1,'pro_16_90',48,'pro'),
('mg_pro_24_90','خصوصی Pro · ۷۲ جلسه · سه‌ماهه','۲۴,۲۲۵,۰۰۰ تومان',90,'private',242250000,1,'pro_24_90',72,'pro'),
('mg_vip_8_90','VIP اختصاصی · ۲۴ جلسه · سه‌ماهه','۱۶,۵۷۵,۰۰۰ تومان',90,'vip',165750000,1,'vip_8_90',24,'vip'),
('mg_vip_10_90','VIP اختصاصی · ۳۰ جلسه · سه‌ماهه','۱۹,۱۲۵,۰۰۰ تومان',90,'vip',191250000,1,'vip_10_90',30,'vip'),
('mg_vip_12_90','VIP اختصاصی · ۳۶ جلسه · سه‌ماهه','۲۱,۶۷۵,۰۰۰ تومان',90,'vip',216750000,1,'vip_12_90',36,'vip'),
('mg_corrective_12_90','اصلاحی · ۳۶ جلسه · سه‌ماهه','۲۱,۶۷۵,۰۰۰ تومان',90,'corrective',216750000,1,'corrective_12_90',36,'special');
