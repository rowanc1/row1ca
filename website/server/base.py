import os
import webapp2
import json
from . import template


DEBUG = os.environ.get('SERVER_SOFTWARE', '').startswith('Dev')
BASE_URL = "http://localhost:8080" if DEBUG else "https://row1.ca"
KINDS = ["Article", "CvItem", "CvAward", "Quote"]
QUERY_TYPES = ["kind", "tag"]
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
    ('/geosci', 'http://geosci.xyz'),
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


class APIHandler(webapp2.RequestHandler):

    def error422(self, reason):

        data = {
            "message": "Malformed Request",
            "reason": reason,
            # "documentation_url": "https://developer.bricks.ink/v1"
        }

        self.response.status_int = 422
        self.response.headers.add_header('Content-Type', 'application/json')
        return self.response.write(json.dumps(data))

    def error404(self):

        data = {
            "message": "Not Found",
            # "documentation_url": "https://developer.bricks.ink/v1"
        }

        self.response.headers.add_header('Content-Type', 'application/json')
        self.response.status_int = 404
        self.response.write(json.dumps(data))
