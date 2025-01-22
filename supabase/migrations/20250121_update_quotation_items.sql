-- Add new columns to quotation_items
alter table quotation_items
  add column if not exists operation text,
  add column if not exists total_price numeric(10,2),
  add column if not exists discount_percentage numeric(5,2),
  add column if not exists painting_hours numeric(5,2);
