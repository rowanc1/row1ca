import cgi
import datetime
import webapp2
import os
import sys

sys.path.insert(1, os.path.join(os.path.abspath('.'), 'lib'))

from google.appengine.ext import ndb
from google.appengine.api import users

import row1
import xmd

isDebug = os.environ.get("SERVER_SOFTWARE", "").startswith("Dev")

guestbook_key = ndb.Key('Guestbook', 'default_guestbook')


class Greeting(ndb.Model):
    author = ndb.UserProperty()
    content = ndb.TextProperty()
    date = ndb.DateTimeProperty(auto_now_add=True)


class MainPage(webapp2.RequestHandler):
    def get(self):

        out = xmd.parse_file('blogs/2016-07-01-finite_volume.xmd')

        row1.utils.template.set(self, {
            "xmd": out
        }, 'index.html')


pointers = [
    ('/', MainPage)
]


sys.modules['__main__'] = None

app = webapp2.WSGIApplication(pointers, debug=isDebug)
