"""Local synthetic recovery checks. No production URL, credentials, or records are used."""
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
import uuid

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('storage_export', ROOT / 'scripts/backup/storage_export.py')
backup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(backup)

class RecoveryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory(prefix='rated420-recovery-fixture-', dir=os.environ.get('BACKUP_TEST_SCRATCH'))
        cls.folder = Path(cls.temp.name)
        cls.home = cls.folder / 'gpg'
        cls.home.mkdir(mode=0o700)
        cls.previous_home = os.environ.get('GNUPGHOME')
        os.environ['GNUPGHOME'] = str(cls.home)
        subprocess.run(['gpg', '--batch', '--pinentry-mode', 'loopback', '--passphrase', '',
                        '--quick-generate-key', 'Synthetic recovery fixture', 'rsa2048', 'encr', '1d'],
                       check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        listing = subprocess.check_output(['gpg', '--batch', '--with-colons', '--list-keys'], stderr=subprocess.DEVNULL).decode()
        cls.recipient = next(line.split(':')[9] for line in listing.splitlines() if line.startswith('fpr:'))

    @classmethod
    def tearDownClass(cls):
        subprocess.run(['gpgconf', '--homedir', str(cls.home), '--kill', 'gpg-agent'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        if cls.previous_home is None:
            os.environ.pop('GNUPGHOME', None)
        else:
            os.environ['GNUPGHOME'] = cls.previous_home
        cls.temp.cleanup()

    def decrypt(self, file):
        return subprocess.check_output(['gpg', '--batch', '--decrypt', str(file)], stderr=subprocess.DEVNULL)

    def fixture_reader(self, drift=False):
        class Reader:
            calls = 0
            payloads = {('fixture-public', 'nested/photo.png'): b'fixture-image-bytes\0\1',
                        ('fixture-private', 'fixture-user/avatar.jpg'): b'fixture-private-avatar'}
            def inventory(self):
                self.calls += 1
                return {'buckets': [{'id': 'fixture-public', 'public': True}, {'id': 'fixture-private', 'public': False}],
                        'files': [{'bucket': bucket, 'key': key, 'record': {
                            'id': key, 'updated_at': 'changed' if drift and self.calls > 1 else 'fixture-v1',
                            'metadata': {'size': len(data), 'mimetype': 'image/fixture'}}}
                            for (bucket, key), data in self.payloads.items()]}
            def download(self, bucket, key):
                yield self.payloads[(bucket, key)]
        return Reader()

    def test_public_and_private_objects_encrypt_and_recover(self):
        output = self.folder / ('objects-' + uuid.uuid4().hex)
        reader = self.fixture_reader()
        result = backup.export_storage(reader, output, self.recipient)
        self.assertEqual(result['objects'], 2)
        manifest = json.loads(self.decrypt(output / 'manifest.json.gpg'))
        for item in manifest['objects']:
            recovered = self.decrypt(output / item['artifact'])
            self.assertEqual(recovered, reader.payloads[(item['bucket'], item['key'])])
            self.assertEqual(hashlib.sha256(recovered).hexdigest(), item['sha256'])
            self.assertEqual((output / item['artifact']).stat().st_mode & 0o077, 0)
        self.assertEqual(backup.verify_storage(output)['objects'], 2)
        self.assertFalse(list(output.rglob('*.jpg')))
        self.assertFalse(list(output.rglob('*.png')))
        item = manifest['objects'][0]
        file = output / item['artifact']
        damaged = bytearray(file.read_bytes()); damaged[len(damaged)//2] ^= 1; file.write_bytes(damaged)
        with self.assertRaises(backup.BackupError):
            backup.verify_storage(output)

    def test_changed_inventory_cannot_be_marked_complete(self):
        output = self.folder / ('changed-' + uuid.uuid4().hex)
        with self.assertRaises(backup.BackupError):
            backup.export_storage(self.fixture_reader(drift=True), output, self.recipient)
        self.assertFalse((output / 'COMPLETE.json').exists())

    def test_paths_and_credential_permissions_fail_closed(self):
        with self.assertRaises(backup.BackupError):
            backup.outside_git(ROOT / 'backups')
        credential = self.folder / 'fixture-key'; credential.write_text('fixture-not-a-credential'); credential.chmod(0o644)
        with self.assertRaises(backup.BackupError):
            backup.private_file(credential)
        credential.chmod(0o600)
        self.assertEqual(backup.private_file(credential), credential)
        with self.assertRaises(backup.BackupError):
            backup.encrypt_chunks([b'fixture'], self.folder / 'invalid.gpg', 'short-id')

    def test_storage_inventory_paginates_and_recurses(self):
        class Response(io.BytesIO):
            def __enter__(self): return self
            def __exit__(self, *args): self.close()
        requests = []
        class Opener:
            def open(self, request, timeout):
                path = request.full_url.split('/storage/v1/')[1]
                requests.append((path, request.get_method()))
                if path == 'bucket': result = [{'id': 'fixture-bucket'}]
                else:
                    query = json.loads(request.data)
                    if query['prefix'] == 'nested/': result = [{'id': 'leaf', 'name': 'photo.png', 'metadata': {'size': 1}}]
                    elif query['offset'] == 0: result = [{'id': str(i), 'name': str(i), 'metadata': {'size': 1}} for i in range(999)] + [{'id': None, 'name': 'nested'}]
                    else: result = [{'id': 'last', 'name': 'last.png', 'metadata': {'size': 1}}]
                return Response(json.dumps(result).encode())
        reader = backup.StorageReader('a'*20, 'fixture-not-a-credential'); reader.opener = Opener()
        inventory = reader.inventory()
        self.assertEqual(len(inventory['files']), 1001)
        self.assertTrue(any(item['key'] == 'nested/photo.png' for item in inventory['files']))
        self.assertTrue(all(method in ('GET', 'POST') for _, method in requests))
        with self.assertRaises(backup.BackupError): reader.request('bucket', {})

    def test_database_auth_records_rls_functions_and_references_round_trip(self):
        container = 'rated420-averages-pg'
        network = subprocess.check_output(['docker', 'inspect', '--format', '{{.HostConfig.NetworkMode}}', container]).decode().strip()
        self.assertEqual(network, 'none')
        source, target = 'backup_fixture_' + uuid.uuid4().hex, 'restore_fixture_' + uuid.uuid4().hex
        def sql(database, query):
            return subprocess.check_output(['docker', 'exec', '-i', container, 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-At', '-U', 'postgres', '-d', database], input=query.encode())
        for database in [source, target]: subprocess.run(['docker', 'exec', container, 'createdb', '-U', 'postgres', database], check=True)
        try:
            sql(source, """create schema auth;create schema storage;
            create table auth.users(id uuid primary key,email text,encrypted_password text);
            create table auth.identities(user_id uuid references auth.users(id),provider text);
            create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
            create table public.reviews(id integer primary key,user_id uuid references auth.users(id),score integer,notes text,photo_path text);
            alter table public.reviews enable row level security;
            create policy fixture_own on public.reviews for all using(user_id=auth.uid()) with check(user_id=auth.uid());
            grant usage on schema auth to authenticated;grant select,insert,update,delete on public.reviews to authenticated;
            create table storage.objects(bucket_id text,name text,metadata jsonb);
            insert into auth.users values('11111111-1111-4111-8111-111111111111','fixture@example.test','fixture-hash-not-a-real-password');
            insert into auth.identities values('11111111-1111-4111-8111-111111111111','email');
            insert into public.reviews values(1,'11111111-1111-4111-8111-111111111111',310,'Synthetic recovery fixture','fixture-user/photo.jpg');
            insert into storage.objects values('fixture-bucket','fixture-user/photo.jpg','{"size":12}');""")
            archive = subprocess.check_output(['docker', 'exec', container, 'pg_dump', '-U', 'postgres', '--format=custom', source])
            encrypted = self.folder / 'database.dump.gpg'
            backup.encrypt_chunks([archive], encrypted, self.recipient)
            recovered = self.decrypt(encrypted)
            self.assertEqual(recovered, archive)
            # No no-owner/no-acl or filtering flags: preserve ownership/grants/policies.
            subprocess.run(['docker', 'exec', '-i', container, 'pg_restore', '-U', 'postgres', '--exit-on-error', '--single-transaction', '-d', target], input=recovered, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            for table in ['auth.users','auth.identities','public.reviews','storage.objects']:
                query = 'select row_to_json(t) from ' + table + ' t;'
                self.assertEqual(sql(source, query), sql(target, query))
            policies = "select row_to_json(t) from (select schemaname,tablename,policyname,roles,cmd,qual,with_check from pg_policies order by schemaname,tablename,policyname) t;"
            self.assertEqual(sql(source, policies), sql(target, policies))
            function = "select pg_get_functiondef('auth.uid()'::regprocedure);"
            self.assertEqual(sql(source, function), sql(target, function))
            self.assertEqual(sql(target, "set role authenticated;select score from public.reviews;").decode().splitlines()[-1:] , ['SET'])
            own = sql(target, "set role authenticated;select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);select score from public.reviews;").decode().splitlines()[-1]
            self.assertEqual(own, '310')
            roles = subprocess.check_output(['docker','exec',container,'pg_dumpall','-U','postgres','--roles-only','--no-role-passwords'])
            backup.encrypt_chunks([roles], self.folder / 'roles.sql.gpg', self.recipient)
            self.assertEqual(self.decrypt(self.folder / 'roles.sql.gpg'), roles)
        finally:
            for database in [source, target]: subprocess.run(['docker','exec',container,'dropdb','-U','postgres',database],check=True)

if __name__ == '__main__': unittest.main()
