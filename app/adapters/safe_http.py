"""Bounded HTTP fetch with public-IP pinning and revalidated redirects.

No environment proxies; TLS still verifies the original hostname. Resolving then
pinning the connection prevents DNS rebinding between validation and connection.
"""

import http.client, socket, ssl, ipaddress, re
from urllib.parse import urlsplit, urljoin

MAX_BYTES = 2_000_000


def validate_url(url):
    parsed = urlsplit(url)
    if (
        parsed.scheme not in ("http", "https")
        or not parsed.hostname
        or parsed.username
        or parsed.password
    ):
        raise ValueError("Use a public HTTP or HTTPS URL without credentials.")
    port = parsed.port or (443 if parsed.scheme == "https" else 80)
    if port not in (80, 443):
        raise ValueError("Only standard HTTP/HTTPS ports are supported.")
    addresses = socket.getaddrinfo(parsed.hostname, port, type=socket.SOCK_STREAM)
    if not addresses:
        raise ValueError("Could not resolve the posting hostname.")
    for address in addresses:
        ip = ipaddress.ip_address(address[4][0])
        if not ip.is_global or ip.is_multicast or ip.is_reserved or ip.is_unspecified:
            raise ValueError(
                "Posting URLs must resolve exclusively to public internet addresses."
            )
    return parsed, port, addresses[0][4][0]


def fetch_public(url, accepted=("text/html", "application/json", "text/plain")):
    for _ in range(4):
        parsed, port, ip = validate_url(url)
        connection = http.client.HTTPConnection(parsed.hostname, port, timeout=15)
        sock = socket.create_connection((ip, port), timeout=15)
        try:
            if parsed.scheme == "https":
                sock = ssl.create_default_context().wrap_socket(
                    sock, server_hostname=parsed.hostname
                )
            connection.sock = sock
            path = parsed.path or "/"
            if parsed.query:
                path += "?" + parsed.query
            connection.request(
                "GET",
                path,
                headers={
                    "User-Agent": "Jobplicator/4.0",
                    "Accept": "text/html,application/json,text/plain",
                    "Accept-Encoding": "identity",
                },
            )
            response = connection.getresponse()
            if response.status in (301, 302, 303, 307, 308):
                location = response.getheader("Location")
                if not location:
                    raise ValueError("The server returned an invalid redirect.")
                url = urljoin(url, location)
                continue
            if response.status != 200:
                raise ValueError(f"The posting server returned HTTP {response.status}.")
            content_type = response.getheader("Content-Type", "").split(";")[0].lower()
            if content_type not in accepted:
                raise ValueError(
                    "Only HTML, JSON or plain-text postings are supported."
                )
            raw = response.read(MAX_BYTES + 1)
            if len(raw) > MAX_BYTES:
                raise ValueError("The posting exceeds the 2 MB import limit.")
            return raw.decode("utf-8", errors="replace")
        finally:
            connection.close()
            sock.close()
    raise ValueError("Too many redirects.")


def board_token(token):
    if not isinstance(token, str) or not re.fullmatch(r"[A-Za-z0-9_-]{1,100}", token):
        raise ValueError(
            "Enter a valid board token (letters, numbers, hyphens or underscores)."
        )
    return token
