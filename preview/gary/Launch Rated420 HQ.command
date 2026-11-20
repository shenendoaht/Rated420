#!/bin/sh
set -eu
cd "$(dirname "$0")"
export RATED420_OPEN_BROWSER=1
exec /usr/bin/perl ./serve-rated420-hq.pl
