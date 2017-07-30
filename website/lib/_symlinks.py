import os
import subprocess
import time


subprocess.call(
    "rm pyparsing.py pyparsing.pyc || :",
    shell=True
)

subprocess.call(
    "rm markdown requests requests_toolbelt 2>/dev/null || :",
    shell=True
)

# The libraries to make links of
import markdown
import pyparsing
import requests
import requests_toolbelt
import future
import jinja2_registry
import properties
import six


LIBS = [
    markdown,
    pyparsing,
    requests,
    requests_toolbelt,
    future,
    jinja2_registry,
    properties,
    six
]

for mod in LIBS:
    path = os.path.realpath(mod.__file__)
    print path
    path = path.replace('/__init__.pyc', '').replace('.pyc', '.py')
    name = path.split('/')[-1].replace('.pyc', '')
    print name, path
    subprocess.call("ln -s %s ." % path, shell=True)
