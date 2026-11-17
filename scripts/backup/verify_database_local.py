#!/usr/bin/env python3
"""Decrypt/restore only into a fresh DB in an existing, isolated LOCAL Docker container.
Never accepts a database URL, production credential, restore host or live service target.
A complete result requires DB content/schema/RLS checks and matching Storage bytes.
"""
import argparse
import datetime
import hashlib
import json
import os
import re
from pathlib import Path
import subprocess
import sys
import tempfile
import uuid
from storage_export import BackupError, outside_git, verify_storage
from database_export import CATALOGUE_SQL, HERE


def command(arguments, data=None):
    result = subprocess.run(arguments, input=data, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    if result.returncode:
        raise BackupError('Local recovery command failed. Inspect the isolated container privately; do not omit failed objects.')
    return result.stdout


def decrypt(file):
    return command(['gpg','--decrypt',str(file)])


def quote_identifier(value):
    return '"' + value.replace('"','""') + '"'


def validate_container(container):
    if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_.-]*',container):
        raise BackupError('Use a plain local container name, never Docker flags.')
    if any(os.environ.get(key) for key in ['DOCKER_HOST','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH']):
        raise BackupError('Unset Docker host/TLS overrides and select a local Docker context explicitly.')
    endpoint = command(['docker','context','inspect','--format','{{.Endpoints.docker.Host}}']).decode().strip()
    if not endpoint.startswith(('unix://','npipe://')):
        raise BackupError('Use a local Docker context, not a remote daemon.')
    info = json.loads(command(['docker','inspect',container]))[0]
    host = info['HostConfig']
    if host['NetworkMode'] != 'none' or host.get('Privileged') or host.get('PidMode') == 'host' or host.get('PortBindings'):
        raise BackupError('Recovery container must have network none, no published ports and no privileged/host-PID access.')
    if any(mount['Type'] == 'bind' for mount in info.get('Mounts',[])):
        raise BackupError('Recovery container must not have host bind mounts or a Docker socket.')


def verify_database(database_export, storage_export, container, scratch):
    database_export, storage_export, scratch = map(outside_git,[database_export,storage_export,scratch])
    if not (database_export/'COMPLETE.json').exists():
        raise BackupError('Database export has no completion marker.')
    validate_container(container)
    def sql(database, text):
        return command(['docker','exec','-i','-e','PGOPTIONS=-c TimeZone=UTC -c row_security=off',container,
                        'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres','-d',database],text.encode())
    others = sql('postgres',"select count(*) from pg_database where datname not in ('postgres','template0','template1');").decode().strip()
    if others != '0':
        raise BackupError('Use a dedicated empty recovery container; other user databases exist.')
    manifest = json.loads(decrypt(database_export/'manifest.json.gpg'))
    if manifest.get('project_ref') != 'ymluyoqkmzxomjokjmkj':
        raise BackupError('Manifest does not identify Rated420.')
    version = int(sql('postgres',"select current_setting('server_version_num');").decode().strip())
    if version//10000 != manifest['catalogue']['server_version_num']//10000:
        raise BackupError('Source and local recovery PostgreSQL major versions must match.')
    available = set(map(tuple,json.loads(sql('postgres',"select coalesce(json_agg(json_build_array(name,version)),'[]') from pg_available_extension_versions;"))))
    if any((item['name'],item['version']) not in available for item in manifest['catalogue']['extensions']):
        raise BackupError('Recovery image lacks required source extension versions. Use a matching pinned Supabase PostgreSQL image; never skip schemas/extensions.')
    # Do not execute raw role SQL against an initialized cluster. Bootstrap missing
    # role names/attributes for ownership and RLS, disabling LOGIN locally.
    roles = []
    existing_roles=set(json.loads(sql('postgres',"select json_agg(rolname) from pg_roles;")))
    for role in manifest['catalogue']['roles']:
        if role['name']=='postgres' or role['name'].startswith('pg_'):
            continue
        flags=['NOLOGIN']+[yes if role[field] else 'NO'+yes for field,yes in [
            ('superuser','SUPERUSER'),('inherit','INHERIT'),('create_role','CREATEROLE'),
            ('create_db','CREATEDB'),('replication','REPLICATION'),('bypass_rls','BYPASSRLS')]]
        if role['name'] not in existing_roles:
            roles.append('create role '+quote_identifier(role['name'])+' '+' '.join(flags)+';')
        else:
            roles.append('alter role '+quote_identifier(role['name'])+' '+' '.join(flags)+';')
    for membership in manifest['catalogue'].get('memberships') or []:
        roles.append('grant '+quote_identifier(membership['role'])+' to '+quote_identifier(membership['member'])+
            ' with admin '+str(membership['admin']).lower()+', inherit '+str(membership['inherit']).lower()+', set '+str(membership['set']).lower()+';')
    sql('postgres','\n'.join(roles))
    database='rated420_recovery_'+uuid.uuid4().hex
    scratch.mkdir(parents=True,exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='rated420-private-restore-',dir=scratch) as temporary:
        os.chmod(temporary,0o700)
        archive=Path(temporary)/'database.dump'
        # Private plaintext exists only on the owner's specified RAM/encrypted scratch.
        with archive.open('xb') as output:
            process=subprocess.Popen(['gpg','--decrypt',str(database_export/'database.dump.gpg')],stdout=output,stderr=subprocess.DEVNULL)
            if process.wait(): raise BackupError('Database archive decryption failed.')
        os.chmod(archive,0o600)
        expected=manifest['artifacts']['database.dump.gpg']
        digest=hashlib.sha256()
        with archive.open('rb') as source:
            for block in iter(lambda:source.read(1024*1024),b''): digest.update(block)
        if archive.stat().st_size!=expected['bytes'] or digest.hexdigest()!=expected['sha256']:
            raise BackupError('Decrypted database archive integrity mismatch.')
        # Verify role-archive integrity too; real login passwords were not exported.
        role_bytes=decrypt(database_export/'roles.sql.gpg'); role_expected=manifest['artifacts']['roles.sql.gpg']
        if len(role_bytes)!=role_expected['bytes'] or hashlib.sha256(role_bytes).hexdigest()!=role_expected['sha256']:
            raise BackupError('Role archive integrity mismatch.')
        command(['docker','exec',container,'createdb','-U','postgres','--template=template0',database])
        try:
            # Extension-created triggers must not transform restored encrypted data.
            # Each phase is transactional in the NEW LOCAL DB; no failed phase is ignored.
            for section in ['pre-data','data','post-data']:
                args=['docker','exec','-i',container,'pg_restore','-U','postgres','--exit-on-error','--single-transaction','--section='+section,'-d',database]
                if section=='data': args+=['--disable-triggers','--superuser=postgres']
                with archive.open('rb') as source:
                    result=subprocess.run(args,stdin=source,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
                if result.returncode: raise BackupError('Local database restore failed; recovery is NOT verified. Do not skip failed objects.')
            inventory=[json.loads(line) for line in sql(database,(HERE/'inventory.sql').read_text()).decode().splitlines() if line.strip()]
            if inventory!=manifest['inventory']: raise BackupError('Restored row counts/content fingerprints differ from source.')
            restored=json.loads(sql(database,CATALOGUE_SQL))
            for field in ['extensions','tables','policies']:
                if restored[field]!=manifest['catalogue'][field]: raise BackupError('Restored schema/ownership/RLS/ACL metadata differs from source.')
            storage=verify_storage(storage_export)
            objects=json.loads(sql(database,"select coalesce(json_agg(json_build_object('bucket',bucket_id,'key',name,'id',id::text,'bytes',(metadata->>'size')::bigint,'metadata',metadata,'updated_at',updated_at) order by bucket_id,name),'[]') from storage.objects;"))
            storage_manifest=json.loads(decrypt(storage_export/'manifest.json.gpg'))
            backed=[{'bucket':item['bucket'],'key':item['key'],'id':str(item['record']['id']),'bytes':item['bytes'],'metadata':item['record'].get('metadata'),'updated_at':item['record'].get('updated_at')} for item in storage_manifest['objects']]
            for collection in [objects,backed]:
                for item in collection:
                    item['metadata']=item.get('metadata') or {}
                    if item.get('updated_at'):
                        item['updated_at']=datetime.datetime.fromisoformat(item['updated_at'].replace('Z','+00:00')).astimezone(datetime.timezone.utc).isoformat()
            if sorted(objects,key=lambda item:(item['bucket'],item['key']))!=sorted(backed,key=lambda item:(item['bucket'],item['key'])):
                raise BackupError('Database Storage snapshot and downloaded object inventory do not match.')
            buckets=json.loads(sql(database,"select coalesce(json_agg(id order by id),'[]') from storage.buckets;"))
            if buckets!=sorted(item['id'] for item in storage_manifest['buckets']): raise BackupError('Bucket inventories differ.')
            return {'status':'VERIFIED_LOCAL_DATABASE_AND_STORAGE_BYTES','project_ref':manifest['project_ref'],
                'tables':len(inventory),'rows':sum(item['rows'] for item in inventory),
                'objects':storage['objects'],'object_bytes':storage['bytes'],
                'source_finished':manifest['finished'],
                'limits':['local role LOGIN disabled; local postgres is the restore operator',
                          'Auth/Storage services and external secrets/provider configuration not tested',
                          'not a production restore or PITR test']}
        finally:
            command(['docker','exec',container,'dropdb','-U','postgres',database])


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--database-export',required=True)
    parser.add_argument('--storage-export',required=True)
    parser.add_argument('--container',default='rated420-recovery-local')
    parser.add_argument('--scratch',required=True,help='Private RAM/encrypted scratch outside Git')
    args=parser.parse_args();os.umask(0o077)
    print(json.dumps(verify_database(args.database_export,args.storage_export,args.container,args.scratch)))

if __name__=='__main__':
    try: main()
    except (BackupError,OSError,ValueError,KeyError):
        print('Recovery verification FAILED. No gate is passed; inspect only the isolated local environment.',file=sys.stderr)
        sys.exit(1)
