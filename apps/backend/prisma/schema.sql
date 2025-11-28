-- ========================================
-- AutoFi Database Schema
-- Supabase PostgreSQL
-- ========================================

-- ========================================
-- Enable Required Extensions
-- ========================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ========================================
-- Tables
-- ========================================

-- Automations
CREATE TABLE IF NOT EXISTS public.automations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Configuration
  name TEXT NOT NULL,
  description TEXT,
  workflow_config JSONB NOT NULL,
  trigger_config JSONB,
  
  -- Risk Management
  risk_score INTEGER DEFAULT 0,
  max_risk_score INTEGER DEFAULT 60,
  requires_approval BOOLEAN DEFAULT false,
  
  -- Status
  enabled BOOLEAN DEFAULT true,
  is_deleted BOOLEAN DEFAULT false,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  last_executed_at TIMESTAMP WITH TIME ZONE,
  
  CONSTRAINT automations_name_not_empty CHECK (name != ''),
  CONSTRAINT automations_risk_score_range CHECK (risk_score >= 0 AND risk_score <= 100),
  CONSTRAINT automations_max_risk_range CHECK (max_risk_score >= 0 AND max_risk_score <= 100)
);

CREATE INDEX IF NOT EXISTS idx_automations_user_id ON public.automations(user_id);
CREATE INDEX IF NOT EXISTS idx_automations_enabled ON public.automations(enabled);
CREATE INDEX IF NOT EXISTS idx_automations_deleted ON public.automations(is_deleted);
CREATE INDEX IF NOT EXISTS idx_automations_created_at ON public.automations(created_at);
CREATE INDEX IF NOT EXISTS idx_automations_user_enabled ON public.automations(user_id, enabled) WHERE is_deleted = false;

-- Execution History
CREATE TABLE IF NOT EXISTS public.execution_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id UUID NOT NULL REFERENCES public.automations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Execution Details
  status TEXT NOT NULL,
  error_message TEXT,
  execution_time_ms INTEGER,
  
  -- Transaction Info
  transaction_hash TEXT,
  block_number INTEGER,
  gas_used INTEGER,
  
  -- Result
  result JSONB,
  
  -- Timestamps
  started_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  
  CONSTRAINT execution_status_valid CHECK (status IN ('pending', 'processing', 'success', 'failed', 'cancelled')),
  CONSTRAINT execution_time_positive CHECK (execution_time_ms IS NULL OR execution_time_ms >= 0)
);

CREATE INDEX IF NOT EXISTS idx_execution_history_automation_id ON public.execution_history(automation_id);
CREATE INDEX IF NOT EXISTS idx_execution_history_user_id ON public.execution_history(user_id);
CREATE INDEX IF NOT EXISTS idx_execution_history_status ON public.execution_history(status);
CREATE INDEX IF NOT EXISTS idx_execution_history_started_at ON public.execution_history(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_history_completed_at ON public.execution_history(completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_history_auto_user ON public.execution_history(automation_id, user_id);

-- Audit Logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Log Details
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  changes JSONB,
  
  -- Request Info
  ip_address INET,
  user_agent TEXT,
  
  -- Timestamp
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  CONSTRAINT audit_action_valid CHECK (action IN ('create', 'update', 'delete', 'execute', 'read'))
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON public.audit_logs(resource_type, resource_id);

-- User Preferences
CREATE TABLE IF NOT EXISTS public.user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Preferences
  theme TEXT DEFAULT 'dark',
  notifications_enabled BOOLEAN DEFAULT true,
  email_on_execution BOOLEAN DEFAULT true,
  email_on_error BOOLEAN DEFAULT true,
  
  -- Wallet Integration
  connected_wallets JSONB,
  primary_wallet TEXT,
  
  -- Privacy
  public_profile BOOLEAN DEFAULT false,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  CONSTRAINT theme_valid CHECK (theme IN ('light', 'dark', 'auto')),
  CONSTRAINT wallet_format CHECK (primary_wallet IS NULL OR primary_wallet ~ '^0x[a-fA-F0-9]{40}$')
);

CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON public.user_preferences(user_id);

-- ========================================
-- Materialized Views (Analytics)
-- ========================================

-- Daily Execution Stats
CREATE MATERIALIZED VIEW IF NOT EXISTS public.daily_execution_stats AS
SELECT
  DATE(eh.started_at) as execution_date,
  eh.user_id,
  COUNT(*) as total_executions,
  COUNT(CASE WHEN eh.status = 'success' THEN 1 END) as successful_executions,
  COUNT(CASE WHEN eh.status = 'failed' THEN 1 END) as failed_executions,
  AVG(EXTRACT(EPOCH FROM (eh.completed_at - eh.started_at))) as avg_execution_time_sec,
  MAX(EXTRACT(EPOCH FROM (eh.completed_at - eh.started_at))) as max_execution_time_sec
FROM public.execution_history eh
GROUP BY DATE(eh.started_at), eh.user_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_execution_stats_unique 
ON public.daily_execution_stats(execution_date, user_id);

-- Automation Performance
CREATE MATERIALIZED VIEW IF NOT EXISTS public.automation_performance AS
SELECT
  a.id as automation_id,
  a.user_id,
  COUNT(eh.id) as total_executions,
  COUNT(CASE WHEN eh.status = 'success' THEN 1 END) as successful_executions,
  ROUND(100.0 * COUNT(CASE WHEN eh.status = 'success' THEN 1 END) / NULLIF(COUNT(*), 0), 2) as success_rate,
  AVG(EXTRACT(EPOCH FROM (eh.completed_at - eh.started_at))) as avg_execution_time_sec,
  MAX(eh.started_at) as last_execution_at
FROM public.automations a
LEFT JOIN public.execution_history eh ON a.id = eh.automation_id
WHERE a.is_deleted = false
GROUP BY a.id, a.user_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_automation_performance_unique 
ON public.automation_performance(automation_id);

-- ========================================
-- Row-Level Security (RLS)
-- ========================================

-- Enable RLS
ALTER TABLE public.automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.execution_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own automations" ON public.automations;
DROP POLICY IF EXISTS "Users can create automations" ON public.automations;
DROP POLICY IF EXISTS "Users can update own automations" ON public.automations;
DROP POLICY IF EXISTS "Users can delete own automations" ON public.automations;
DROP POLICY IF EXISTS "Users can view own execution history" ON public.execution_history;
DROP POLICY IF EXISTS "Users can create execution records" ON public.execution_history;
DROP POLICY IF EXISTS "Users can update own execution records" ON public.execution_history;
DROP POLICY IF EXISTS "Users can view own audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Users can create audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Users can view own preferences" ON public.user_preferences;
DROP POLICY IF EXISTS "Users can create own preferences" ON public.user_preferences;
DROP POLICY IF EXISTS "Users can update own preferences" ON public.user_preferences;

-- Automations RLS
-- Users can only see their own automations
CREATE POLICY "Users can view own automations" ON public.automations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create automations" ON public.automations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own automations" ON public.automations
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own automations" ON public.automations
  FOR DELETE USING (auth.uid() = user_id);

-- Execution History RLS
-- Users can only see their own execution history
CREATE POLICY "Users can view own execution history" ON public.execution_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create execution records" ON public.execution_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own execution records" ON public.execution_history
  FOR UPDATE USING (auth.uid() = user_id);

-- Audit Logs RLS
-- Users can only see their own audit logs
CREATE POLICY "Users can view own audit logs" ON public.audit_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create audit logs" ON public.audit_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- User Preferences RLS
-- Users can only see and modify their own preferences
CREATE POLICY "Users can view own preferences" ON public.user_preferences
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own preferences" ON public.user_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences" ON public.user_preferences
  FOR UPDATE USING (auth.uid() = user_id);

-- ========================================
-- Functions and Triggers
-- ========================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS update_automations_updated_at ON public.automations;
DROP TRIGGER IF EXISTS update_user_preferences_updated_at ON public.user_preferences;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Trigger for automations
CREATE TRIGGER update_automations_updated_at BEFORE UPDATE ON public.automations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger for user_preferences
CREATE TRIGGER update_user_preferences_updated_at BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Refresh materialized view function
CREATE OR REPLACE FUNCTION public.refresh_analytics_views()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.daily_execution_stats;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.automation_performance;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- Initial Data
-- ========================================

-- Create default user preferences for new users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ========================================
-- Grants (Optional - for service role)
-- ========================================

-- Grant permissions to anon role (public access with RLS)
GRANT USAGE ON SCHEMA public TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automations TO anon;
GRANT SELECT, INSERT, UPDATE ON public.execution_history TO anon;
GRANT SELECT, INSERT ON public.audit_logs TO anon;
GRANT SELECT, INSERT, UPDATE ON public.user_preferences TO anon;
GRANT SELECT ON public.daily_execution_stats TO anon;
GRANT SELECT ON public.automation_performance TO anon;

-- Grant permissions to authenticated role
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automations TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.execution_history TO authenticated;
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.user_preferences TO authenticated;
GRANT SELECT ON public.daily_execution_stats TO authenticated;
GRANT SELECT ON public.automation_performance TO authenticated;

-- ========================================
-- Comments (Documentation)
-- ========================================

COMMENT ON TABLE public.automations IS 'User automation configurations and workflows';
COMMENT ON TABLE public.execution_history IS 'Records of automation executions and results';
COMMENT ON TABLE public.audit_logs IS 'Audit trail of user actions for compliance';
COMMENT ON TABLE public.user_preferences IS 'User preferences and settings';
COMMENT ON MATERIALIZED VIEW public.daily_execution_stats IS 'Daily execution statistics by user';
COMMENT ON MATERIALIZED VIEW public.automation_performance IS 'Performance metrics for each automation';

COMMENT ON COLUMN public.automations.workflow_config IS 'JSON configuration: {type, params, targets}';
COMMENT ON COLUMN public.automations.trigger_config IS 'JSON configuration: {type, schedule, conditions}';
COMMENT ON COLUMN public.automations.risk_score IS 'Current risk assessment score 0-100';
COMMENT ON COLUMN public.execution_history.status IS 'pending | processing | success | failed | cancelled';
COMMENT ON COLUMN public.execution_history.result IS 'JSON result including transaction details and outcomes';

-- ========================================
-- Setup Complete
-- ========================================

-- Verify tables were created
SELECT 
  tablename,
  (SELECT count(*) FROM information_schema.columns WHERE table_name = tablename) as column_count
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;
