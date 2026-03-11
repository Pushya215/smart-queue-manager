ALTER TABLE public.booked_tokens ADD COLUMN IF NOT EXISTS is_emergency boolean NOT NULL DEFAULT false;
ALTER TABLE public.booked_tokens ADD COLUMN IF NOT EXISTS emergency_approved boolean NOT NULL DEFAULT false;
ALTER TABLE public.booked_tokens ADD COLUMN IF NOT EXISTS emergency_reason text;