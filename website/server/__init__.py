from __future__ import print_function

import webapp2
import os
from . import template
from . import persist
from . import models

DEBUG = os.environ.get('SERVER_SOFTWARE', '').startswith('Dev')

RESERVED = {
    'profile',
    'about',
    'settings'
}


POINTERS = []


def route(uri):
    """flask style routes for webapp2"""
    def wrapper(cls):
        global POINTERS
        POINTERS += [
            webapp2.Route(uri, cls)
        ]
        return cls
    return wrapper


class Handler(webapp2.RequestHandler):

    def error404(self):
        renderer = template.Renderer('pages/404.html')
        self.response.status_int = 404
        self.response.write(renderer.render())


@route('/<slug:' + models.RE_SLUG + '>')
class Ink(Handler):
    def get(self, slug):
        if slug not in persist.SLUGS:
            return self.error404()
        brick = persist.BRICKS[slug]
        self.response.write(brick.render_html_page())


@route('/')
class Profile(Handler):
    def get(self):
        brick = persist.BRICKS['profile']
        self.response.write(brick.render_html_page())


@route('/<:.*>')
class Error404(Handler):
    def get(self, url):
        self.error404()

app = webapp2.WSGIApplication(POINTERS, debug=DEBUG)
