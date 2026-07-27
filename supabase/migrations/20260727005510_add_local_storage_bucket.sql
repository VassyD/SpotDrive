-- Local dev parity: the spot-photos bucket exists in production (created
-- manually via the dashboard, matching production's "Public bucket" setting)
-- but was never created in local dev, since storage buckets aren't part of
-- the normal schema and don't get seeded automatically.
insert into storage.buckets (id, name, public)
values ('spot-photos', 'spot-photos', true)
on conflict (id) do nothing;