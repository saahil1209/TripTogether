"""
Reads a Supabase connection string (or a bare password) on stdin and writes a
correct DATABASE_URL into .env.local.

Kept as its own file rather than inlined in the shell script so the quoting
stays readable. Invoked by scripts/set-db-password.sh — not meant to be run
directly, since it expects the secret on stdin and never echoes it.
"""

from __future__ import annotations

import pathlib
import re
import sys
import urllib.parse

TEMPLATE_USER = "postgres.bcmdgasjjdfwplcwilvb"
TEMPLATE_HOST = "aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres"

PLACEHOLDERS = ("[YOUR-PASSWORD]", "YOUR-PASSWORD", "PASSWORD_HERE", "[YOUR_PASSWORD]")

URL_PATTERN = re.compile(r"^(?P<head>postgres(?:ql)?://[^:/@]+:)(?P<pw>.*)(?P<tail>@[^@]+)$")


def fail(message: str) -> None:
    print(message, file=sys.stderr)
    raise SystemExit(1)


def build_url(raw: str) -> tuple[str, str]:
    """Returns (url, what_was_read)."""
    if raw.startswith("postgres"):
        match = URL_PATTERN.match(raw)
        if not match:
            fail("That does not look like a connection string. Nothing was changed.")
        # Decode first, so a string that is already encoded is not encoded twice.
        password = urllib.parse.unquote(match.group("pw"))
        if not password:
            fail("That connection string has no password in it. Nothing was changed.")
        check_placeholder(password)
        encoded = urllib.parse.quote(password, safe="")
        return match.group("head") + encoded + match.group("tail"), "connection string"

    check_placeholder(raw)
    encoded = urllib.parse.quote(raw, safe="")
    return f"postgresql://{TEMPLATE_USER}:{encoded}@{TEMPLATE_HOST}", "password"


def check_placeholder(password: str) -> None:
    for placeholder in PLACEHOLDERS:
        if placeholder in password:
            fail(
                f"The password is still the literal placeholder {placeholder!r}.\n"
                "Copy the connection string again and replace that placeholder with\n"
                "your real database password before pasting it here."
            )


def main() -> None:
    raw = sys.stdin.read().strip()
    if not raw:
        fail("Nothing entered. No changes made.")

    url, source = build_url(raw)

    path = pathlib.Path(".env.local")
    text = path.read_text()
    line = f"DATABASE_URL={url}"
    if re.search(r"(?m)^DATABASE_URL=", text):
        text = re.sub(r"(?m)^DATABASE_URL=.*$", lambda _: line, text)
    else:
        text = text.rstrip() + "\n" + line + "\n"
    path.write_text(text)

    masked = re.sub(r"(://[^:]+:)[^@]+(@)", r"\1********\2", url)
    print(f"Read a {source}. Saved to .env.local as:")
    print(f"  {masked}")


if __name__ == "__main__":
    main()
