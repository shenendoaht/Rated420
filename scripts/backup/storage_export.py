#!/usr/bin/env python3
"""Read-only Storage export. Run on the owner's computer; requires existing credentials.
Object bytes and their private manifest are GPG-encrypted before writing to disk.
No upload, bucket mutation, credential creation, SQL or production restore operation exists.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request

class BackupError(Exception):
    pass

def outside_git(path):
    path = Path(path).expanduser().resolve()
    existing = path
    while not existing.exists():
        existing = existing.parent
    if not existing.is_dir():
        existing = existing.parent
    environment = os.environ.copy()
    for variable in ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_COMMON_DIR', 'GIT_CEILING_DIRECTORIES']:
        environment.pop(variable, None)
    environment['LC_ALL'] = 'C'
    result = subprocess.run(['git', '-c', 'safe.directory=*', '-C', str(existing),
                             'rev-parse', '--show-toplevel'], capture_output=True,
                            text=True, env=environment)
    if result.returncode == 0:
        raise BackupError('Backup and credential paths must be outside Git worktrees.')
    if 'not a git repository' not in result.stderr.lower():
        raise BackupError('Could not establish that this path is outside Git.')
    return path

def private_file(path):
    original = Path(path).expanduser()
    if original.is_symlink():
        raise BackupError('Use a private regular credential file, not a symlink.')
    path = outside_git(original)
    if not path.is_file() or path.stat().st_mode & 0o077:
        raise BackupError('Credential file must be a regular file with mode 0600.')
    return path

def encrypt_chunks(chunks, destination, recipient):
    if not re.fullmatch(r'[A-Fa-f0-9]{40}|[A-Fa-f0-9]{64}', recipient):
        raise BackupError('Use a verified full GPG fingerprint, not an email or short key ID.')
    destination = Path(destination)
    if destination.exists():
        raise BackupError('Refusing to overwrite a backup artifact.')
    temporary = destination.with_name(destination.name + '.partial')
    if temporary.exists():
        raise BackupError('A partial backup artifact already exists; inspect it privately first.')
    digest, size = hashlib.sha256(), 0
    command = ['gpg', '--batch', '--no-auto-key-retrieve', '--auto-key-locate', 'clear',
               '--trust-model', 'always', '--encrypt', '--recipient', recipient,
               '--output', str(temporary)]
    process = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.DEVNULL,
                               stderr=subprocess.DEVNULL)
    try:
        for chunk in chunks:
            digest.update(chunk)
            size += len(chunk)
            process.stdin.write(chunk)
        process.stdin.close()
        if process.wait() != 0:
            raise BackupError('Encryption failed. Verify the recipient key locally.')
        os.chmod(temporary, 0o600)
        temporary.rename(destination)
        return {'sha256': digest.hexdigest(), 'bytes': size}
    except BaseException:
        if process.stdin and not process.stdin.closed:
            try:
                process.stdin.close()
            except OSError:
                pass
        if process.poll() is None:
            process.terminate()
            process.wait()
        temporary.unlink(missing_ok=True)
        raise

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, file, code, message, headers, url):
        raise BackupError('Unexpected redirect; credentials were not forwarded.')

class StorageReader:
    def __init__(self, project_ref, key):
        if not re.fullmatch('[a-z]{20}', project_ref):
            raise BackupError('Invalid Supabase project reference.')
        self.base = 'https://' + project_ref + '.supabase.co/storage/v1/'
        self.key = key
        self.opener = urllib.request.build_opener(NoRedirect())

    def request(self, path, payload=None):
        # POST here is exclusively Storage's read-only object-list endpoint.
        if payload is not None and not path.startswith('object/list/'):
            raise BackupError('Only read-only listing POSTs are allowed.')
        body = None if payload is None else json.dumps(payload).encode()
        request = urllib.request.Request(self.base + path, data=body, headers={
            'apikey': self.key, 'Authorization': 'Bearer ' + self.key,
            'Content-Type': 'application/json', 'Accept-Encoding': 'identity'})
        try:
            return self.opener.open(request, timeout=60)
        except urllib.error.HTTPError as error:
            raise BackupError('Storage read failed with HTTP ' + str(error.code)) from None
        except urllib.error.URLError:
            raise BackupError('Storage TLS/network read failed.') from None

    def inventory(self):
        with self.request('bucket') as response:
            buckets = json.load(response)
        if not isinstance(buckets, list):
            raise BackupError('Unexpected bucket-list response.')
        files = []
        for bucket in sorted(buckets, key=lambda item: item['id']):
            pending, visited = [''], set()
            while pending:
                prefix = pending.pop()
                if prefix in visited:
                    raise BackupError('Repeated folder detected; inventory is not stable.')
                visited.add(prefix)
                offset = 0
                while True:
                    with self.request('object/list/' + urllib.parse.quote(bucket['id'], safe=''), {
                        'prefix': prefix, 'limit': 1000, 'offset': offset,
                        'sortBy': {'column': 'name', 'order': 'asc'}}) as response:
                        page = json.load(response)
                    if not isinstance(page, list):
                        raise BackupError('Unexpected object-list response.')
                    for item in page:
                        name = item.get('name', '')
                        if not name or name in ('.', '..') or '/' in name or '\\' in name:
                            raise BackupError('Unsafe object/folder name in inventory.')
                        key = prefix + name
                        if item.get('id') is None:
                            pending.append(key + '/')
                        else:
                            files.append({'bucket': bucket['id'], 'key': key, 'record': item})
                    if len(page) < 1000:
                        break
                    offset += len(page)
        files.sort(key=lambda item: (item['bucket'], item['key']))
        identities = [(item['bucket'], item['key']) for item in files]
        if len(set(identities)) != len(identities):
            raise BackupError('Duplicate inventory entries; source may have changed.')
        return {'buckets': sorted(buckets, key=lambda item: item['id']), 'files': files}

    def download(self, bucket, key):
        path = 'object/' + urllib.parse.quote(bucket, safe='') + '/' + urllib.parse.quote(key, safe='/')
        with self.request(path) as response:
            while True:
                chunk = response.read(1024 * 1024)
                if not chunk:
                    break
                yield chunk

def export_storage(reader, output, recipient):
    output = outside_git(output)
    if output.exists():
        raise BackupError('Use a new output directory; existing backups are never overwritten.')
    output.mkdir(parents=True, mode=0o700)
    os.chmod(output, 0o700)
    (output / 'objects').mkdir(mode=0o700)
    before = reader.inventory()
    manifest = {'format': 1, 'buckets': before['buckets'], 'objects': []}
    for item in before['files']:
        identifier = hashlib.sha256((item['bucket'] + '\0' + item['key']).encode()).hexdigest()
        artifact = 'objects/' + identifier + '.gpg'
        verified = encrypt_chunks(reader.download(item['bucket'], item['key']), output / artifact, recipient)
        expected_size = item['record'].get('metadata', {}).get('size')
        if expected_size is not None and verified['bytes'] != int(expected_size):
            raise BackupError('Object size differs from source metadata; backup is incomplete.')
        manifest['objects'].append({**item, **verified, 'artifact': artifact})
    def stable(inventory):
        return {'buckets': inventory['buckets'], 'files': [
            {'bucket': item['bucket'], 'key': item['key'],
             'record': {key: value for key, value in item['record'].items() if key != 'last_accessed_at'}}
            for item in inventory['files']]}
    if stable(before) != stable(reader.inventory()):
        raise BackupError('Storage changed during export; do not use this as a consistent recovery point.')
    encrypt_chunks([json.dumps(manifest, sort_keys=True).encode()], output / 'manifest.json.gpg', recipient)
    summary = {'status': 'COMPLETE_STORAGE_EXPORT', 'buckets': len(manifest['buckets']),
               'objects': len(manifest['objects']), 'bytes': sum(item['bytes'] for item in manifest['objects'])}
    (output / 'COMPLETE.json').write_text(json.dumps(summary, indent=2) + '\n')
    os.chmod(output / 'COMPLETE.json', 0o600)
    return summary

def verify_storage(output):
    output = outside_git(output)
    if not (output / 'COMPLETE.json').exists():
        raise BackupError('No completion marker; this export is incomplete.')
    def decrypt(path):
        return subprocess.Popen(['gpg', '--decrypt', str(path)], stdout=subprocess.PIPE,
                                stderr=subprocess.DEVNULL)
    process = decrypt(output / 'manifest.json.gpg')
    manifest_bytes, _ = process.communicate()
    if process.returncode:
        raise BackupError('Manifest could not be decrypted with the recovery key.')
    manifest = json.loads(manifest_bytes)
    total = 0
    for item in manifest['objects']:
        if not re.fullmatch(r'objects/[0-9a-f]{64}\.gpg', item['artifact']):
            raise BackupError('Invalid encrypted artifact path.')
        process = decrypt(output / item['artifact'])
        digest, size = hashlib.sha256(), 0
        while True:
            chunk = process.stdout.read(1024 * 1024)
            if not chunk:
                break
            digest.update(chunk)
            size += len(chunk)
        process.stdout.close()
        if process.wait() or digest.hexdigest() != item['sha256'] or size != item['bytes']:
            raise BackupError('Object recovery integrity check failed.')
        total += size
    return {'status': 'VERIFIED_STORAGE_BYTES', 'objects': len(manifest['objects']), 'bytes': total}

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='command', required=True)
    export = sub.add_parser('export')
    export.add_argument('--project-ref', required=True)
    export.add_argument('--key-file', required=True)
    export.add_argument('--recipient', required=True)
    export.add_argument('--output', required=True)
    verify = sub.add_parser('verify')
    verify.add_argument('--output', required=True)
    args = parser.parse_args()
    os.umask(0o077)
    if args.command == 'export':
        key = private_file(args.key_file).read_text().strip()
        if not key or any(character.isspace() for character in key):
            raise BackupError('Invalid credential file format.')
        result = export_storage(StorageReader(args.project_ref, key), args.output, args.recipient)
    else:
        result = verify_storage(args.output)
    print(json.dumps(result))

if __name__ == '__main__':
    try:
        main()
    except (BackupError, OSError, ValueError, KeyError, BrokenPipeError):
        print('Backup/recovery check failed. No completion guarantee; inspect locally without sharing secrets.', file=sys.stderr)
        sys.exit(1)
