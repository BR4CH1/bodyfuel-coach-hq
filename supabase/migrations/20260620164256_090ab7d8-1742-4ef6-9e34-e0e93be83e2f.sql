UPDATE public.customer_packages SET end_date = DATE '2099-12-31' WHERE end_date IS NULL;
ALTER TABLE public.customer_packages
  ALTER COLUMN end_date SET NOT NULL,
  ALTER COLUMN end_date SET DEFAULT DATE '2099-12-31';