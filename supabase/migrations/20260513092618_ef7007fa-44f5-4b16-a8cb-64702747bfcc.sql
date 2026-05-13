
-- ============ ENUMS ============
DO $$ BEGIN
  CREATE TYPE public.payment_account_type AS ENUM (
    'bank_local','bank_international','easypaisa','jazzcash','sadapay','nayapay','wise','payoneer','crypto','other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.payment_account_purpose AS ENUM ('inward','outward','both');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.payment_account_change_type AS ENUM ('created','updated','deactivated','reactivated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ PROFILE PAYMENT ACCOUNTS ============
CREATE TABLE IF NOT EXISTS public.profile_payment_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  account_type public.payment_account_type NOT NULL,
  account_title TEXT NOT NULL,
  account_number TEXT,
  iban TEXT,
  bank_name TEXT,
  bank_branch TEXT,
  bank_swift TEXT,
  currency TEXT NOT NULL DEFAULT 'PKR',
  is_primary BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id)
);
CREATE INDEX IF NOT EXISTS idx_ppa_profile ON public.profile_payment_accounts(profile_id);
CREATE INDEX IF NOT EXISTS idx_ppa_active ON public.profile_payment_accounts(profile_id, is_active);

-- One primary per (profile, currency) among active accounts
CREATE UNIQUE INDEX IF NOT EXISTS uq_ppa_primary_per_currency
  ON public.profile_payment_accounts(profile_id, currency)
  WHERE is_primary = true AND is_active = true;

ALTER TABLE public.profile_payment_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ppa_select_self_or_admin" ON public.profile_payment_accounts
  FOR SELECT USING (
    auth.uid() = profile_id OR public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid())
  );
CREATE POLICY "ppa_insert_self_or_admin" ON public.profile_payment_accounts
  FOR INSERT WITH CHECK (
    auth.uid() = profile_id OR public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid())
  );
CREATE POLICY "ppa_update_self_or_admin" ON public.profile_payment_accounts
  FOR UPDATE USING (
    auth.uid() = profile_id OR public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid())
  );
CREATE POLICY "ppa_delete_admin_only" ON public.profile_payment_accounts
  FOR DELETE USING (public.is_super_admin(auth.uid()));

CREATE TRIGGER trg_ppa_updated_at
  BEFORE UPDATE ON public.profile_payment_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ HISTORY (AUDIT LOG) ============
CREATE TABLE IF NOT EXISTS public.profile_payment_account_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL,
  account_id UUID NOT NULL,
  change_type public.payment_account_change_type NOT NULL,
  previous_values JSONB,
  new_values JSONB,
  changed_by UUID REFERENCES public.profiles(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reason TEXT
);
CREATE INDEX IF NOT EXISTS idx_ppah_account ON public.profile_payment_account_history(account_id);
CREATE INDEX IF NOT EXISTS idx_ppah_profile ON public.profile_payment_account_history(profile_id);

ALTER TABLE public.profile_payment_account_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ppah_select_self_or_admin" ON public.profile_payment_account_history
  FOR SELECT USING (
    auth.uid() = profile_id OR public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid())
  );
CREATE POLICY "ppah_insert_any_authed" ON public.profile_payment_account_history
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
-- No update/delete policies => immutable

-- Auto-log trigger
CREATE OR REPLACE FUNCTION public.fn_log_payment_account_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.profile_payment_account_history(profile_id, account_id, change_type, new_values, changed_by)
    VALUES (NEW.profile_id, NEW.id, 'created', to_jsonb(NEW), auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.is_active = true AND NEW.is_active = false THEN
      INSERT INTO public.profile_payment_account_history(profile_id, account_id, change_type, previous_values, new_values, changed_by)
      VALUES (NEW.profile_id, NEW.id, 'deactivated', to_jsonb(OLD), to_jsonb(NEW), auth.uid());
    ELSIF OLD.is_active = false AND NEW.is_active = true THEN
      INSERT INTO public.profile_payment_account_history(profile_id, account_id, change_type, previous_values, new_values, changed_by)
      VALUES (NEW.profile_id, NEW.id, 'reactivated', to_jsonb(OLD), to_jsonb(NEW), auth.uid());
    ELSE
      INSERT INTO public.profile_payment_account_history(profile_id, account_id, change_type, previous_values, new_values, changed_by)
      VALUES (NEW.profile_id, NEW.id, 'updated', to_jsonb(OLD), to_jsonb(NEW), auth.uid());
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_ppa_changes
  AFTER INSERT OR UPDATE ON public.profile_payment_accounts
  FOR EACH ROW EXECUTE FUNCTION public.fn_log_payment_account_change();

-- Enforce single primary per currency per profile
CREATE OR REPLACE FUNCTION public.fn_enforce_single_primary_account()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.is_primary = true AND NEW.is_active = true THEN
    UPDATE public.profile_payment_accounts
      SET is_primary = false
      WHERE profile_id = NEW.profile_id
        AND currency = NEW.currency
        AND id <> NEW.id
        AND is_primary = true;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_single_primary
  BEFORE INSERT OR UPDATE ON public.profile_payment_accounts
  FOR EACH ROW EXECUTE FUNCTION public.fn_enforce_single_primary_account();

-- ============ ORGANIZATION PAYMENT ACCOUNTS ============
CREATE TABLE IF NOT EXISTS public.organization_payment_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  account_type public.payment_account_type NOT NULL,
  purpose public.payment_account_purpose NOT NULL DEFAULT 'inward',
  account_title TEXT NOT NULL,
  account_number TEXT,
  iban TEXT,
  bank_name TEXT,
  bank_branch TEXT,
  bank_swift TEXT,
  currency TEXT NOT NULL DEFAULT 'PKR',
  display_label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id)
);
CREATE INDEX IF NOT EXISTS idx_opa_active ON public.organization_payment_accounts(is_active, sort_order);

ALTER TABLE public.organization_payment_accounts ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read active org accounts (so they show on invoices)
CREATE POLICY "opa_select_authed" ON public.organization_payment_accounts
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "opa_insert_admin" ON public.organization_payment_accounts
  FOR INSERT WITH CHECK (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));
CREATE POLICY "opa_update_admin" ON public.organization_payment_accounts
  FOR UPDATE USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));
CREATE POLICY "opa_delete_super_admin" ON public.organization_payment_accounts
  FOR DELETE USING (public.is_super_admin(auth.uid()));

CREATE TRIGGER trg_opa_updated_at
  BEFORE UPDATE ON public.organization_payment_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ EXTEND EXISTING TABLES ============
ALTER TABLE public.fee_invoices
  ADD COLUMN IF NOT EXISTS payment_instructions JSONB,
  ADD COLUMN IF NOT EXISTS student_account_snapshot JSONB;

ALTER TABLE public.salary_payouts
  ADD COLUMN IF NOT EXISTS recipient_account_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS payment_channel TEXT;

ALTER TABLE public.payment_transactions
  ADD COLUMN IF NOT EXISTS from_account_ref TEXT,
  ADD COLUMN IF NOT EXISTS to_account_ref TEXT,
  ADD COLUMN IF NOT EXISTS transaction_reference TEXT;
