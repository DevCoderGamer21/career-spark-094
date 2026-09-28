ALTER TABLE public.integration_events
  ADD COLUMN attempt integer NOT NULL DEFAULT 1,
  ADD COLUMN retry_of uuid REFERENCES public.integration_events(id),
  ADD COLUMN target text,
  ADD COLUMN body text;