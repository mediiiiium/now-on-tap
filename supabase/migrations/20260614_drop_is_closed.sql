-- bars.is_closed は全行 false 固定で未使用。
-- 閉店判定は status = 'closed' に統一したため、カラムを削除する。
ALTER TABLE bars DROP COLUMN IF EXISTS is_closed;
