-- Notch — database setup
-- Run this in Supabase → SQL Editor

-- profiles
CREATE TABLE IF NOT EXISTS profiles (
  id                UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name              TEXT NOT NULL,
  monthly_income    NUMERIC DEFAULT 0,
  monthly_budget    NUMERIC DEFAULT 0,
  xp                INTEGER DEFAULT 0,
  streak            INTEGER DEFAULT 0,
  longest_streak    INTEGER DEFAULT 0,
  last_entry_date   DATE,
  freezes_available INTEGER DEFAULT 1,
  join_date         DATE DEFAULT CURRENT_DATE,
  onboarding_done   BOOLEAN DEFAULT false,
  quests_data       JSONB,
  achievements      TEXT[] DEFAULT '{}',
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- expenses
CREATE TABLE IF NOT EXISTS expenses (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  amount     NUMERIC NOT NULL,
  cat_id     TEXT NOT NULL,
  cat_name   TEXT NOT NULL,
  icon       TEXT DEFAULT '',
  note       TEXT DEFAULT '',
  date       DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- profiles: each user sees and edits only their own row
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_insert" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_delete" ON profiles FOR DELETE USING (auth.uid() = id);

-- expenses: each user sees and edits only their own rows
CREATE POLICY "expenses_select" ON expenses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "expenses_insert" ON expenses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "expenses_delete" ON expenses FOR DELETE USING (auth.uid() = user_id);

-- incomes
CREATE TABLE IF NOT EXISTS incomes (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  amount     NUMERIC NOT NULL,
  type       TEXT NOT NULL DEFAULT 'other',
  type_name  TEXT NOT NULL DEFAULT 'Другое',
  note       TEXT DEFAULT '',
  date       DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- currency columns (migration)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'RUB';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS base_currency TEXT DEFAULT 'RUB';

-- fixed monthly expenses (migration)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS fixed_expenses JSONB DEFAULT '[]'::jsonb;

-- league week tracking (migration)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS xp_this_week INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS league_week  DATE;

-- expenses update policy (for edit feature)
CREATE POLICY IF NOT EXISTS "expenses_update" ON expenses FOR UPDATE USING (auth.uid() = user_id);

-- league entries table
CREATE TABLE IF NOT EXISTS league_entries (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  xp_this_week INTEGER DEFAULT 0,
  total_xp     INTEGER DEFAULT 0,
  league       TEXT DEFAULT 'bronze',
  week_start   DATE NOT NULL,
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE league_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "league_select" ON league_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY IF NOT EXISTS "league_upsert" ON league_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY IF NOT EXISTS "league_update" ON league_entries FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY IF NOT EXISTS "league_delete" ON league_entries FOR DELETE USING (auth.uid() = user_id);

ALTER TABLE incomes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "incomes_select" ON incomes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "incomes_insert" ON incomes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "incomes_delete" ON incomes FOR DELETE USING (auth.uid() = user_id);

-- savings goals (migration)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS savings_goals JSONB DEFAULT '[]'::jsonb;
