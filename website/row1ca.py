import cgi
import datetime
import webapp2
import os

from google.appengine.ext import ndb
from google.appengine.api import users

import row1

isDebug = os.environ.get("SERVER_SOFTWARE", "").startswith("Dev")

guestbook_key = ndb.Key('Guestbook', 'default_guestbook')


class Greeting(ndb.Model):
    author = ndb.UserProperty()
    content = ndb.TextProperty()
    date = ndb.DateTimeProperty(auto_now_add=True)


class MainPage(webapp2.RequestHandler):
    def get(self):
        row1.utils.template.set(self, {}, 'index.html')


pointers = [
    ('/', MainPage)
]

app = webapp2.WSGIApplication(pointers, debug=isDebug)
