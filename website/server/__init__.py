from __future__ import print_function

import webapp2
from . import base
import api
import routes


@base.route('/<:.*>')
class Error404(base.Handler):
    def get(self, url):
        return self.error404()


app = webapp2.WSGIApplication(base.POINTERS, debug=base.DEBUG)
