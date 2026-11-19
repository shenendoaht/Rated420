-- Synthetic fixture for a fresh, isolated Build 01 database.
insert into rated420_build.items(id, kind, name, description) values
  ('demo-brand','brand','Demo Orchard Co.','Synthetic testing fixture'),
  ('houseplant-grinder','accessory','Shen’s blue Houseplant glass grinder','Accessory fixture'),
  ('puffco','accessory','Al’s Puffco','Accessory fixture')
on conflict (id) do nothing;
insert into rated420_build.polls(id, question, options) values
  ('33333333-3333-4333-8333-333333333333','What should The Vault cover next?',array['New York growers','Dispensary design'])
on conflict (id) do nothing;
