-- Two hours of made-up API requests (about 2.5 million rows).
create table if not exists requests (
  id bigserial primary key,
  at timestamptz not null,
  route text not null,
  status int not null,
  ms int not null
);
insert into requests (at, route, status, ms)
select now() - random() * interval '2 hours',
       (array['/api/checkout', '/api/cart', '/api/search', '/api/login', '/api/orders'])[1 + floor(random() * 5)],
       case when random() < 0.02 then 500 else 200 end,
       (20 + random() ^ 3 * 800)::int
  from generate_series(1, 2500000);
create index if not exists requests_at on requests (at);
analyze requests;
