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

REDIRECTS = [
    ('/thoughts/probability-of-a-spill', '/probability-of-a-spill'),
    ('/s/pdfs/courses/RichardsEquation.pdf', '/pdf/richards-equation-simulation.pdf'),
    ('/thoughts/stereonet-plane-tutorial', '/stereonet'),
    ('/s/pdfs/courses/LogicallyOrthogonalMesh.pdf', '/pdf/logically-rectangular-mesh.pdf'),
    ('/s/pdfs/courses/HydraulicConductivityInversion.pdf', '/pdf/richards-equation-inversion.pdf'),
    ('/thoughts/weakform-dc', '/weakform-dc'),
    ('/s/pdfs/courses/DCresistivity.pdf', '/pdf/dc-resistivity-objective-functions.pdf'),
    ('/s/pdfs/AGU2012.pdf', '/pdf/agu-2012-visible-geology.pdf'),
    ('/thoughts/paper-cubes', '/visible-geology-paper-cubes'),
    ('/s/presentations/2013/MSc2PhD/index.html', '/static/msc2phd/index.html'),
    ('/s/presentations/2013/Richards/index.html', '/static/richards-equation/index.html'),
    ('/s/presentations/2013/LOM/index.html', '/static/logically-rectangular-mesh/index.html'),
    ('/s/pdfs/AGU2009.pdf', '/pdf/agu-2009-rock-physics.pdf'),
    ('/thoughts/stereonet-on-google-app-engine', '/stereonet'),
    ('/s/pdfs/RSR2010.pdf', '/pdf/rsr-2010-rock-physics.pdf'),
    ('/simpeg/simpeg-framework-design', '/simpeg-framework-design'),
    ('/thoughts/innovative-dissemination-of-research-award', '/innovative-dissemination-award-visible-geology'),
    ('/s/pdfs/courses/BlockCG.pdf', '/pdf/dc-resistivity-block-cg.pdf'),
    ('/thoughts/stereonet-teaching', '/on-teaching-stereonets'),
    ('/presentations/open-access-tools', '/open-access-tools'),
    ('/thoughts/visible-earthquakes', '/visible-earthquakes'),
    ('/s/pdfs/AGU2010_Monitoring.pdf', '/pdf/agu-2010-monitoring-infiltration.pdf'),
    ('/about', '/story'),
]


POINTERS = [
    webapp2.Route(
        uri_from, handler=webapp2.RedirectHandler,
        defaults={'_uri': uri_to}
    )
    for uri_from, uri_to in REDIRECTS
]


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
