"""Local synthetic recovery checks. No production URL, credentials, or records are used."""
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import time
import tempfile
import unittest
from unittest.mock import patch
import uuid

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('storage_export', ROOT / 'scripts/backup/storage_export.py')
backup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(backup)
sys.modules['storage_export']=backup
sys.path.insert(0,str(ROOT/'scripts/backup'))
import database_export
import verify_database_local

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
                            'id': str(uuid.uuid5(uuid.NAMESPACE_URL,bucket+'/'+key)), 'updated_at': '2026-01-02T00:00:00+00:00' if drift and self.calls > 1 else '2026-01-01T00:00:00+00:00',
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

    def test_database_credentials_require_existing_private_files_verified_tls_and_read_only_options(self):
        service=self.folder/'pg_service.conf';password=self.folder/'fixture.pgpass'
        def write(options):
            service.write_text('[rated420-backup]\nhost=db.'+database_export.PROJECT+'.supabase.co\nport=5432\ndbname=postgres\nuser=postgres\n'+options)
            service.chmod(0o600)
        password.write_text('fixture:5432:postgres:postgres:unused-fixture');password.chmod(0o600)
        write('sslmode=verify-full\nsslrootcert=system\n')
        environment=database_export.checked_service(service,password,'rated420-backup')
        self.assertIn('default_transaction_read_only=on',environment['PGOPTIONS'])
        self.assertNotIn('PGPASSWORD',environment)
        write('sslmode=require\n')
        with self.assertRaises(backup.BackupError): database_export.checked_service(service,password,'rated420-backup')
        write('sslmode=verify-full\noptions=-c default_transaction_read_only=off\n')
        with self.assertRaises(backup.BackupError): database_export.checked_service(service,password,'rated420-backup')
        write('sslmode=verify-full\nhostaddr=127.0.0.1\n')
        with self.assertRaises(backup.BackupError): database_export.checked_service(service,password,'rated420-backup')
        write('sslmode=verify-full\npassword=unused-fixture\n')
        with self.assertRaises(backup.BackupError): database_export.checked_service(service,password,'rated420-backup')

    def test_local_verifier_rejects_remote_or_networked_restore_targets(self):
        with patch.dict(os.environ,{'DOCKER_HOST':'tcp://fixture.invalid:2375'}):
            with self.assertRaises(backup.BackupError): verify_database_local.validate_container('fixture')
        with self.assertRaises(backup.BackupError): verify_database_local.validate_container('--host=fixture')
        with patch.dict(os.environ,{},clear=True):
            with patch.object(verify_database_local,'command',return_value=b'ssh://fixture.invalid'):
                with self.assertRaises(backup.BackupError): verify_database_local.validate_container('fixture')
            for host,mounts in [({'NetworkMode':'bridge'},[]),({'NetworkMode':'none','PortBindings':{'5432/tcp':[]}},[]),({'NetworkMode':'none'},[{'Type':'bind'}]),({'NetworkMode':'none','Privileged':True},[])]:
                with patch.object(verify_database_local,'command',side_effect=[b'unix:///fixture.sock',json.dumps([{'HostConfig':host,'Mounts':mounts}]).encode()]):
                    with self.assertRaises(backup.BackupError): verify_database_local.validate_container('fixture')

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

    def test_combined_recovery_verifier_checks_database_and_storage_snapshot(self):
        source_container='rated420-averages-pg'
        source='backup_combined_'+uuid.uuid4().hex
        target='rated420-recovery-fixture-'+uuid.uuid4().hex[:12]
        subprocess.run(['docker','exec',source_container,'createdb','-U','postgres',source],check=True)
        subprocess.run(['docker','run','-d','--name',target,'--network','none','--label','rated420.fixture-recovery=yes','-e','POSTGRES_HOST_AUTH_METHOD=trust','postgres:17.6'],check=True,stdout=subprocess.DEVNULL)
        def sql(query):
            return subprocess.check_output(['docker','exec','-i',source_container,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres','-d',source],input=query.encode())
        try:
            for attempt in range(100):
                if subprocess.run(['docker','exec',target,'pg_isready','-U','postgres'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode==0: break
                time.sleep(.1)
            else: self.fail('Local fixture recovery PostgreSQL did not start')
            sql("""create schema auth;create schema storage;
            create table auth.users(id uuid primary key,email text,encrypted_password text);
            create table auth.identities(user_id uuid references auth.users(id),provider text);
            create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
            create table public.strain_reviews(id integer primary key,user_id uuid references auth.users(id),score integer,notes text,photo_path text);
            alter table public.strain_reviews enable row level security;
            create policy fixture_own on public.strain_reviews for all using(user_id=auth.uid()) with check(user_id=auth.uid());
            grant usage on schema auth to authenticated;grant select,insert,update,delete on public.strain_reviews to authenticated;
            create table storage.buckets(id text primary key,public boolean);
            create table storage.objects(id uuid primary key,bucket_id text references storage.buckets(id),name text,metadata jsonb,updated_at timestamptz);
            insert into auth.users values('11111111-1111-4111-8111-111111111111','fixture@example.test','fixture-not-a-real-password-hash');
            insert into auth.identities values('11111111-1111-4111-8111-111111111111','email');
            insert into public.strain_reviews values(1,'11111111-1111-4111-8111-111111111111',310,'Synthetic fixture','nested/photo.png');""")
            reader=self.fixture_reader()
            for bucket in ['fixture-public','fixture-private']:
                sql("insert into storage.buckets values('"+bucket+"',"+str(bucket=='fixture-public').lower()+");")
            for (bucket,key),payload in reader.payloads.items():
                identifier=str(uuid.uuid5(uuid.NAMESPACE_URL,bucket+'/'+key))
                metadata=json.dumps({"size":len(payload),"mimetype":"image/fixture"})
                sql("insert into storage.objects values('"+identifier+"','"+bucket+"','"+key+"','"+metadata+"','2026-01-01T00:00:00+00:00');")
            database_folder=self.folder/('database-'+uuid.uuid4().hex);database_folder.mkdir(mode=0o700)
            artifacts={}
            for name,command in [('database.dump.gpg',['pg_dump','-U','postgres','--format=custom',source]),('roles.sql.gpg',['pg_dumpall','-U','postgres','--roles-only','--no-role-passwords'])]:
                content=subprocess.check_output(['docker','exec',source_container,*command])
                artifacts[name]=backup.encrypt_chunks([content],database_folder/name,self.recipient)
            manifest={'format':1,'project_ref':database_export.PROJECT,'synthetic':True,'finished':'fixture-time',
                'catalogue':json.loads(sql(database_export.CATALOGUE_SQL)),
                'inventory':[json.loads(line) for line in sql((ROOT/'scripts/backup/inventory.sql').read_text()).decode().splitlines() if line.strip()],
                'artifacts':artifacts}
            backup.encrypt_chunks([json.dumps(manifest).encode()],database_folder/'manifest.json.gpg',self.recipient)
            (database_folder/'COMPLETE.json').write_text('{}')
            storage_folder=self.folder/('combined-storage-'+uuid.uuid4().hex)
            backup.export_storage(reader,storage_folder,self.recipient)
            report=verify_database_local.verify_database(database_folder,storage_folder,target,self.folder/'scratch')
            self.assertEqual(report['status'],'VERIFIED_LOCAL_DATABASE_AND_STORAGE_BYTES')
            self.assertEqual(report['objects'],2)
            self.assertEqual(report['tables'],5)
            # Same-size replacement across the two capture windows must fail.
            manifest_path=storage_folder/'manifest.json.gpg'
            changed=json.loads(self.decrypt(manifest_path))
            changed['objects'][0]['record']['updated_at']='2026-01-02T00:00:00+00:00'
            manifest_path.unlink()
            backup.encrypt_chunks([json.dumps(changed).encode()],manifest_path,self.recipient)
            with self.assertRaisesRegex(backup.BackupError,'snapshot'):
                verify_database_local.verify_database(database_folder,storage_folder,target,self.folder/'scratch')
        finally:
            subprocess.run(['docker','exec',source_container,'dropdb','-U','postgres',source],check=True)
            subprocess.run(['docker','rm','-fv',target],check=True,stdout=subprocess.DEVNULL)

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
