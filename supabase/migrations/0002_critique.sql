-- Resume Tailor — add multi-category critique to generation history.
-- Nullable sibling column, not a new `mode`: critique is a one-to-one
-- attachment to a resume-mode generation, same lifecycle, same RLS.

alter table public.generations add column critique jsonb;
