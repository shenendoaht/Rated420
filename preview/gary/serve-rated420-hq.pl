#!/usr/bin/perl
use strict;
use warnings;
use FindBin;
use IO::Socket::INET;

chdir $FindBin::Bin or die "Cannot open the demo folder: $!\n";
my $address = '127.0.0.1';
my $port = 8767;
my $socket = IO::Socket::INET->new(
    LocalAddr => $address, LocalPort => $port, Proto => 'tcp',
    Listen => 16, ReuseAddr => 1,
) or die "Cannot start the local demo at http://$address:$port/ ($!). Close any other copy of the launcher and retry.\n";

my %mime = (
    html => 'text/html; charset=utf-8', css => 'text/css; charset=utf-8',
    js => 'text/javascript; charset=utf-8', txt => 'text/plain; charset=utf-8', woff2 => 'font/woff2',
    png => 'image/png', webp => 'image/webp',
);
my %files = map { $_ => 1 } (
    'index.html', 'hq-workspace.css', 'hq-workspace-store.js', 'hq-workspace-ui.js', 'rated420-hq-preview.js',
    'expansion-layout.css', 'expansion-fixtures.js', 'expansion-store.js', 'expansion-ui.js',
    'profile-layout.css', 'profile-avatar.js', 'profile-examples.js',
    'synthetic-media-kit.txt', 'rated420-logo.png', glob('fonts/fonts.css'),
    glob('fonts/*.woff2'), glob('images/*.png'), glob('images/*.webp'),
);

$SIG{PIPE} = 'IGNORE';
$| = 1;
print "Rated420 HQ offline preview\nOpen http://$address:$port/ in Chrome.\n";
print "Keep this window open while you use the demo. Press Control-C to stop.\n";
if ($ENV{RATED420_OPEN_BROWSER} && $^O eq 'darwin') {
    system('/usr/bin/open', '-a', 'Google Chrome', "http://$address:$port/");
}

while (my $client = $socket->accept()) {
    eval {
        local $SIG{ALRM} = sub { die "Client timeout\n" };
        alarm 5;
        binmode $client;
        my $line = <$client> // '';
        my ($method, $target) = $line =~ /^(GET|HEAD) (\/[^ ]*) HTTP\/1\.[01]\r?\n$/;
        my $headers = 0;
        while (my $header = <$client>) {
            last if $header =~ /^\r?\n$/;
            die "Too many headers\n" if ++$headers > 64;
        }
        my ($path) = ($target // '') =~ /^\/([A-Za-z0-9.\/_-]*)(?:\?[^\r\n]*)?$/;
        $path = 'index.html' if defined($path) && $path eq '';
        my ($status, $type, $body) = ('404 Not Found', 'text/plain; charset=utf-8', 'Not found');
        if ($method && defined($path) && $files{$path} && open(my $file, '<:raw', $path)) {
            local $/;
            $body = <$file>;
            close $file;
            my ($ext) = $path =~ /\.([a-z0-9]+)$/;
            ($status, $type) = ('200 OK', $mime{$ext});
        }
        print {$client} "HTTP/1.1 $status\r\nContent-Type: $type\r\nContent-Length: " . length($body)
            . "\r\nCache-Control: no-store\r\nX-Content-Type-Options: nosniff\r\nConnection: close\r\n\r\n";
        print {$client} $body unless ($method // '') eq 'HEAD';
    };
    alarm 0;
    close $client;
}
