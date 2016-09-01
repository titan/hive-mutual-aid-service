-- 互助模块
CREATE TABLE mutual_aids(
  id uuid PRIMARY KEY,
  no char(40) NOT NULL,
  driver_id uuid NOT NULL, 
  vid uuid NOT NULL,
  city char(40) NOT NULL,
  district char(40) NOT NULL,
  street char(100) NOT NULL,
  phone char(20) NOT NULL,
  occurred_at timestamp NOT NULL,
  responsibility char(20) NOT NULL,
  situation text NOT NULL,
  description text NOT NULL,
  scene_view char(1024) NOT NULL,
  vehicle_damaged_view char(1024) NOT NULL,
  vehicle_frontal_view char(1024) NOT NULL,
  driver_view char(1024) NOT NULL,
  driver_license_view char(1024) NOT NULL,
  state boolean NOT NULL
);
CREATE TABLE recompense(
  id uuid PRIMARY KEY,
  mid uuid NOT NULL REFERENCES mutual_aids ON DELETE CASCADE,
  personal_fee char(20) NOT NULL,
  personal_balance numeric NOT NULL,
  small_hive_fee char(20) NOT NULL,
  small_hive_balance numeric NOT NULL,
  big_hive_fee char(20) NOT NULL,
  big_hive_balance numeric NOT NULL,
  paid_at timestamp NOT NULL
);