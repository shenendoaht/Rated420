-- Editorial starter entries. Unknown release dates remain null.
-- Explicit UUIDs make subsequent runs safe without undoing staff edits.
insert into rated420_hq.library(id,kind,title,description,image,url,position,published) values
('b0200000-0000-4000-8000-000000000001','episode','Rated 420:NY Episode 1 - AETERNA','Episode from the official Rated 420 : NY channel.','artwork','https://www.youtube.com/watch?v=_sIMx7bO0MQ',10,true),
('b0200000-0000-4000-8000-000000000002','episode','Rated 420:NY Episode 2 - TREEHOUSE','Episode from the official Rated 420 : NY channel.','artwork','https://www.youtube.com/watch?v=5A0oNueR_SM',20,true),
('b0200000-0000-4000-8000-000000000003','merch','Rated420 T-shirt','Branded concept preview · Coming soon.','tee','',10,true),
('b0200000-0000-4000-8000-000000000004','merch','Rated420 hoodie','Branded concept preview · Coming soon.','hoodie','',20,true),
('b0200000-0000-4000-8000-000000000005','merch','Rated420 cap','Branded concept preview · Coming soon.','hat','',30,true),
('b0200000-0000-4000-8000-000000000006','merch','Rated420 sticker','Branded concept preview · Coming soon.','sticker','',40,true)
on conflict (id) do nothing;
