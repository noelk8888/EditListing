-- Create app_settings table for global configuration
CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create backup_logs table for tracking history and urgency logic
CREATE TABLE IF NOT EXISTS backup_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status TEXT NOT NULL, -- 'SUCCESS', 'FAILED'
    type TEXT NOT NULL,   -- 'MASTER', 'COPY'
    destination_url TEXT,
    error_message TEXT
);

-- Initial backup configuration for LUXE Copy
INSERT INTO app_settings (key, value)
VALUES (
    'backup_config', 
    '{
        "destination_url": "https://docs.google.com/spreadsheets/d/1_COUN2E42JCCAPk_IEEfiIAOaVOqrknJ-XodBSJg9rU/edit?gid=1307446787#gid=1307446787",
        "last_backup_at": null
    }'::jsonb
) ON CONFLICT (key) DO NOTHING;
