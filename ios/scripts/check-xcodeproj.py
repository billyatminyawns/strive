#!/usr/bin/env python3
"""Sanity-checks Strive.xcodeproj without Xcode: parses the OpenStep plist, verifies every object reference
resolves, and prints the key app build settings."""
import os
import re
import sys

PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "Strive.xcodeproj", "project.pbxproj")


class Parser:
    def __init__(self, text):
        self.s = text
        self.i = 0

    def ws(self):
        while self.i < len(self.s):
            if self.s.startswith("//", self.i):
                self.i = self.s.index("\n", self.i) + 1
            elif self.s.startswith("/*", self.i):
                self.i = self.s.index("*/", self.i) + 2
            elif self.s[self.i].isspace():
                self.i += 1
            else:
                return

    def expect(self, ch):
        self.ws()
        if self.s[self.i] != ch:
            raise SyntaxError(f"expected {ch!r} at offset {self.i}: {self.s[self.i:self.i + 40]!r}")
        self.i += 1

    def value(self):
        self.ws()
        c = self.s[self.i]
        if c == "{":
            self.i += 1
            d = {}
            while True:
                self.ws()
                if self.s[self.i] == "}":
                    self.i += 1
                    return d
                k = self.string()
                self.expect("=")
                d[k] = self.value()
                self.expect(";")
        if c == "(":
            self.i += 1
            items = []
            while True:
                self.ws()
                if self.s[self.i] == ")":
                    self.i += 1
                    return items
                items.append(self.value())
                self.ws()
                if self.s[self.i] == ",":
                    self.i += 1
        return self.string()

    def string(self):
        self.ws()
        if self.s[self.i] == '"':
            self.i += 1
            out = []
            while self.s[self.i] != '"':
                if self.s[self.i] == "\\":
                    self.i += 1
                out.append(self.s[self.i])
                self.i += 1
            self.i += 1
            return "".join(out)
        m = re.compile(r"[A-Za-z0-9_$./:+-]+").match(self.s, self.i)
        if not m:
            raise SyntaxError(f"bad token at offset {self.i}: {self.s[self.i:self.i + 40]!r}")
        self.i = m.end()
        return m.group(0)


def main():
    text = open(PATH).read()
    root = Parser(text).value()
    objects = root["objects"]
    refs = set(re.findall(r"\b[0-9A-F]{24}\b", text))
    dangling = sorted(r for r in refs if r not in objects)
    print(f"objectVersion {root['objectVersion']} · {len(objects)} objects · {len(refs)} ids referenced")
    if dangling or root["rootObject"] not in objects:
        print("DANGLING:", dangling)
        sys.exit(1)
    for obj in objects.values():
        if obj.get("isa") == "PBXNativeTarget":
            print(f"target {obj['name']}: {obj['productType']}")
    app = next(o["buildSettings"] for o in objects.values()
               if o.get("isa") == "XCBuildConfiguration" and o["buildSettings"].get("INFOPLIST_FILE"))
    for key in ("PRODUCT_BUNDLE_IDENTIFIER", "MARKETING_VERSION", "CURRENT_PROJECT_VERSION",
                "IPHONEOS_DEPLOYMENT_TARGET", "TARGETED_DEVICE_FAMILY", "DEVELOPMENT_TEAM"):
        print(f"  {key} = {app.get(key, '(unset — inherits project)')!r}")
    print("OK")


main()
