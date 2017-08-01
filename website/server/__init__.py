from __future__ import print_function

import webapp2
import os
import json
from . import template
from . import models

DEBUG = os.environ.get('SERVER_SOFTWARE', '').startswith('Dev')

RESERVED = {
    'profile',
    'about',
    'settings'
}

SLUGS = {
    _ for _ in os.listdir('./thoughts')
    if os.path.isdir('./thoughts/' + _)
}


def get_info(slug):
    with open('./thoughts/' + slug + '/info.json', 'r') as f:
        return models.Thought(**json.loads(f.read()))

BRICKS = {
    slug: get_info(slug) for slug in SLUGS
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

        if slug not in SLUGS:
            self.error404()
            return

        brick = BRICKS[slug]

        renderer = template.Renderer('pages/' + brick.kind + '.html')
        renderer.update({
            'brick': brick
        })
        self.response.write(renderer.render())


@route('/')
class Profile(Handler):
    def get(self):

        brick = BRICKS['profile']

        renderer = template.Renderer('pages/' + brick.kind + '.html')
        renderer.update({
            'brick': brick
        })
        self.response.write(renderer.render())


@route('/<:.*>')
class Error404(Handler):
    def get(self, url):
        self.error404()

app = webapp2.WSGIApplication(POINTERS, debug=DEBUG)
