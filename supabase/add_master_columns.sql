-- bars
alter table bars add column if not exists website_url text;
alter table bars add column if not exists google_maps_url text;

-- breweries
alter table breweries add column if not exists website_url text;
alter table breweries add column if not exists untappd_url text;
alter table breweries add column if not exists needs_review boolean default false;

-- beer_styles
alter table beer_styles add column if not exists needs_review boolean default false;
