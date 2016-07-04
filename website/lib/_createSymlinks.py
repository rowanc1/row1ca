import os, subprocess, time

subprocess.call("rm markdown pyparsing 2>/dev/null || :",shell=True)

import markdown, pyparsing

LIBS = [markdown, pyparsing]

for mod in LIBS:
    path = os.path.realpath(mod.__file__)

    print path
    path = path.replace('/__init__.pyc', '').replace('.pyc','.py')
    name = path.split('/')[-1].replace('.pyc', '')
    print name, path
    subprocess.call("ln -s %s ."%path, shell=True)
