#!/usr/bin/env python3
"""Owner-run full encrypted logical export. Native PostgreSQL 17 clients required.
Existing connection credentials stay in private libpq files outside Git, never argv.
This script only runs read-only catalog queries, pg_dump and pg_dumpall.
"""
import argparse
import configparser
import datetime
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
from storage_export import BackupError, outside_git, private_file, encrypt_chunks

PROJECT = 'ymluyoqkmzxomjokjmkj'
HERE = Path(__file__).resolve().parent

CATALOGUE_SQL = """select jsonb_build_object(
 'server_version',current_setting('server_version'),
 'server_version_num',current_setting('server_version_num')::integer,
 'database',current_database(),
 'extensions',(select jsonb_agg(jsonb_build_object('name',extname,'version',extversion) order by extname) from pg_extension),
 'roles',(select jsonb_agg(jsonb_build_object('name',rolname,'superuser',rolsuper,'inherit',rolinherit,'create_role',rolcreaterole,'create_db',rolcreatedb,'login',rolcanlogin,'replication',rolreplication,'bypass_rls',rolbypassrls) order by rolname) from pg_roles),
 'memberships',(select jsonb_agg(jsonb_build_object('role',r.rolname,'member',m.rolname,'admin',a.admin_option,'inherit',a.inherit_option,'set',a.set_option) order by r.rolname,m.rolname) from pg_auth_members a join pg_roles r on r.oid=a.roleid join pg_roles m on m.oid=a.member),
 'tables',(select jsonb_agg(jsonb_build_object('schema',n.nspname,'name',c.relname,'owner',pg_get_userbyid(c.relowner),'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity,'acl',c.relacl::text) order by n.nspname,c.relname) from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind in ('r','p') and n.nspname <> 'information_schema' and n.nspname !~ '^pg_'),
 'policies',(select jsonb_agg(to_jsonb(p) order by p.schemaname,p.tablename,p.policyname) from pg_policies p));"""

def checked_service(service_file, pass_file, name):
    service_file, pass_file = private_file(service_file), private_file(pass_file)
    if not re.fullmatch('[A-Za-z0-9_-]+', name):
        raise BackupError('Use a simple libpq service name, never a connection URL.')
    parser = configparser.ConfigParser(interpolation=None)
    parser.read(service_file)
    if name not in parser:
        raise BackupError('Requested service is absent from the private service file.')
    config = parser[name]
    if set(config)-{'host','port','dbname','user','sslmode','sslrootcert'}:
        raise BackupError('Put only connection metadata in the service file; password belongs in the separate passfile.')
    if config.get('sslmode') != 'verify-full' or config.get('port') != '5432' or config.get('dbname') != 'postgres':
        raise BackupError('Require verified TLS and the direct/session connection on port 5432 to postgres.')
    host, user = config.get('host',''), config.get('user','')
    direct = host == 'db.' + PROJECT + '.supabase.co' and user == 'postgres'
    session = host.endswith('.pooler.supabase.com') and user == 'postgres.' + PROJECT
    if not (direct or session):
        raise BackupError('Connection metadata does not identify the approved Rated420 project.')
    environment = {key:value for key,value in os.environ.items() if not key.startswith('PG')}
    environment.update(PGSERVICEFILE=str(service_file), PGPASSFILE=str(pass_file), PGSERVICE=name,
        PGCONNECT_TIMEOUT='15', PGAPPNAME='rated420-readonly-backup', PGCLIENTENCODING='UTF8',
        PGOPTIONS='-c default_transaction_read_only=on -c row_security=off -c TimeZone=UTC -c lock_timeout=5000 -c statement_timeout=600000')
    return environment

def client_output(command, environment):
    result = subprocess.run(command, env=environment, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    if result.returncode:
        raise BackupError('Read-only PostgreSQL export/query failed. Check access privately; no server errors were logged.')
    return result.stdout

def encrypted_client(command, environment, output, recipient):
    process = subprocess.Popen(command, env=environment, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    def chunks():
        while True:
            chunk = process.stdout.read(1024 * 1024)
            if not chunk:
                break
            yield chunk
        if process.wait():
            raise BackupError('PostgreSQL export failed; partial output is not a valid backup.')
    try:
        return encrypt_chunks(chunks(), output, recipient)
    finally:
        process.stdout.close()
        if process.poll() is None:
            process.terminate()
            process.wait()

def export_database(service_file, pass_file, service, output, recipient):
    for program in ['pg_dump','pg_dumpall','psql','gpg','git']:
        if not shutil.which(program):
            raise BackupError('Install native PostgreSQL 17 clients, GPG and Git before export.')
    environment = checked_service(service_file, pass_file, service)
    psql = ['psql','-X','-qAt','--no-password','-v','ON_ERROR_STOP=1']
    before = json.loads(client_output(psql + ['-c', CATALOGUE_SQL], environment))
    if before['server_version_num'] // 10000 != 17:
        raise BackupError('This reviewed procedure targets PostgreSQL 17; review compatibility before exporting another major version.')
    version = client_output(['pg_dump','--version'], environment).decode()
    match = re.search(r'\b(\d+)\.\d+', version)
    if not match or int(match.group(1)) != 17:
        raise BackupError('Use PostgreSQL 17 pg_dump clients for this project.')
    output = outside_git(output)
    if output.exists():
        raise BackupError('Use a new output directory; existing backups are not overwritten.')
    output.mkdir(parents=True, mode=0o700); os.chmod(output, 0o700)
    started = datetime.datetime.now(datetime.timezone.utc).isoformat()
    inventory_before = client_output(psql + ['-f', str(HERE / 'inventory.sql')], environment)
    artifacts = {}
    # No schema, table, Auth, ownership or ACL exclusions. Auth password hashes are included.
    artifacts['database.dump.gpg'] = encrypted_client(['pg_dump','--no-password','--format=custom'], environment, output / 'database.dump.gpg', recipient)
    # Database-role login passwords are intentionally omitted; existing password-manager copies are separate.
    artifacts['roles.sql.gpg'] = encrypted_client(['pg_dumpall','--no-password','--roles-only','--no-role-passwords'], environment, output / 'roles.sql.gpg', recipient)
    after = json.loads(client_output(psql + ['-c', CATALOGUE_SQL], environment))
    inventory_after = client_output(psql + ['-f', str(HERE / 'inventory.sql')], environment)
    if before != after or inventory_before != inventory_after:
        raise BackupError('Source changed during export. No completion marker; retry in a quiet window without freezing/modifying production.')
    inventory = [json.loads(line) for line in inventory_after.decode().splitlines() if line.strip()]
    tables = {(row['schema'],row['table']) for row in inventory}
    if not {('auth','users'),('auth','identities'),('storage','objects'),('storage','buckets'),('public','strain_reviews')} <= tables:
        raise BackupError('Required Auth/Storage/application tables are missing from the recovery inventory.')
    manifest = {'format':1,'project_ref':PROJECT,'started':started,
        'finished':datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'catalogue':after,'inventory':inventory,'artifacts':artifacts}
    encrypt_chunks([json.dumps(manifest,sort_keys=True).encode()], output / 'manifest.json.gpg', recipient)
    summary = {'status':'COMPLETE_DATABASE_EXPORT','tables':len(inventory),
        'rows':sum(row['rows'] for row in inventory),'project_ref':PROJECT,
        'started':manifest['started'],'finished':manifest['finished']}
    (output / 'COMPLETE.json').write_text(json.dumps(summary,indent=2) + '\n');os.chmod(output / 'COMPLETE.json',0o600)
    return summary

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--service-file',required=True)
    parser.add_argument('--pass-file',required=True)
    parser.add_argument('--service',default='rated420-backup')
    parser.add_argument('--output',required=True)
    parser.add_argument('--recipient',required=True)
    args=parser.parse_args();os.umask(0o077)
    print(json.dumps(export_database(args.service_file,args.pass_file,args.service,args.output,args.recipient)))

if __name__ == '__main__':
    try: main()
    except (BackupError,OSError,ValueError,KeyError,BrokenPipeError):
        print('Database backup incomplete. Check local prerequisites/access without sharing credentials; no recovery gate is passed.',file=sys.stderr)
        sys.exit(1)
