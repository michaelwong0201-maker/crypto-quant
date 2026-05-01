#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Patch FreqUI index.html: lang, title, noscript, zh-cn-runtime.js (cache-bust query)."""
from __future__ import annotations

import re
import sys
from pathlib import Path


def main() -> None:
    if len(sys.argv) < 2:
        print("usage: inject_frequi_zh_index.py <index.html> [version]", file=sys.stderr)
        sys.exit(2)
    path = Path(sys.argv[1])
    version = sys.argv[2] if len(sys.argv) > 2 else "overlay"

    html = path.read_text(encoding="utf-8")

    if re.search(r"<html\b[^>]*\blang=", html):
        html = re.sub(r"<html(\b[^>]*)\blang=\"[^\"]*\"", r'<html\1lang="zh-CN"', html, count=1)
    else:
        html = re.sub(r"<html(\b[^>]*)>", r'<html\1 lang="zh-CN">', html, count=1)

    html = re.sub(
        r"<title>[^<]*</title>",
        "<title>Freqtrade 量化交易控制台</title>",
        html,
        count=1,
    )

    inject_line = f'  <script defer src="/zh-cn-runtime.js?v={version}"></script>\n'
    if "zh-cn-runtime.js" not in html:
        replaced, n = re.subn(
            r'(<script\s+type="module"[^>]*src="/assets/[^"]+\.js"[^>]*></script>)',
            r"\1\n" + inject_line.rstrip("\n"),
            html,
            count=1,
        )
        if n != 1:
            print("inject_frequi_zh_index: could not find module script tag to inject after", file=sys.stderr)
            sys.exit(1)
        html = replaced
    else:
        html = re.sub(
            r'/zh-cn-runtime\.js\?v=[^"]*"',
            f'/zh-cn-runtime.js?v={version}"',
            html,
        )

    html = re.sub(
        r"<noscript>\s*<strong>[\s\S]*?</strong>\s*</noscript>",
        "<noscript>\n"
        "    <strong>FreqUI 需要启用 JavaScript 才能正常工作。请在浏览器中启用 JavaScript 后继续。</strong>\n"
        "  </noscript>",
        html,
        count=1,
    )

    path.write_text(html, encoding="utf-8")


if __name__ == "__main__":
    main()
