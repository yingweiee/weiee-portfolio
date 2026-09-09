#!/usr/bin/env python3
"""Dev server that never serves you a stale file.

`python3 -m http.server` sends no `Cache-Control` at all, only
`Last-Modified`. With no explicit policy browsers fall back to *heuristic*
caching — they guess a freshness lifetime and serve from cache without
revalidating — so an edit can sit on disk, be served correctly, and still not
be what you are looking at. Every "it didn't change" moment in this project
traced back to that.

This is the same static server with two things added:

  * `Cache-Control: no-store` on everything, so a plain reload is always enough
  * range requests, so audio and video can seek (the stock server can't, which
    makes a `<video>` unseekable)

    python3 tools/serve.py [port]
"""

import functools
import os
import re
import sys
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 4321
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Accept-Ranges", "bytes")
        super().end_headers()

    def send_head(self):
        """Serve a byte range when one is asked for, otherwise behave normally."""
        rng = self.headers.get("Range")
        if not rng:
            return super().send_head()

        match = re.fullmatch(r"bytes=(\d*)-(\d*)", rng.strip())
        path = self.translate_path(self.path)
        if not match or not os.path.isfile(path):
            return super().send_head()

        size = os.path.getsize(path)
        start, end = match.group(1), match.group(2)
        if start == "":                      # bytes=-N — the final N bytes
            start, end = max(0, size - int(end or 0)), size - 1
        else:
            start = int(start)
            end = int(end) if end else size - 1
        end = min(end, size - 1)

        if start > end or start >= size:
            self.send_response(HTTPStatus.REQUESTED_RANGE_NOT_SATISFIABLE)
            self.send_header("Content-Range", f"bytes */{size}")
            self.end_headers()
            return None

        f = open(path, "rb")
        f.seek(start)
        self.send_response(HTTPStatus.PARTIAL_CONTENT)
        self.send_header("Content-Type", self.guess_type(path))
        self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.send_header("Content-Length", str(end - start + 1))
        self.end_headers()
        return _Slice(f, end - start + 1)

    def log_message(self, fmt, *args):        # one tidy line, not three
        sys.stderr.write("%s %s\n" % (self.command, self.path))


class _Slice:
    """A file object that stops after `remaining` bytes, for copyfile()."""

    def __init__(self, f, remaining):
        self.f, self.remaining = f, remaining

    def read(self, n=-1):
        if self.remaining <= 0:
            return b""
        if n < 0 or n > self.remaining:
            n = self.remaining
        chunk = self.f.read(n)
        self.remaining -= len(chunk)
        return chunk

    def close(self):
        self.f.close()


if __name__ == "__main__":
    handler = functools.partial(Handler, directory=ROOT)
    print(f"serving {ROOT} on http://localhost:{PORT}  (no-store, ranges on)")
    ThreadingHTTPServer(("", PORT), handler).serve_forever()
