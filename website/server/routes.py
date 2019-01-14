from __future__ import print_function

from . import base
from . import persist
from . import models


@base.route('/<slug:' + models.RE_SLUG + '>')
class Ink(base.Handler):
    def get(self, slug):
        if slug not in persist.SLUGS:
            return self.error404()
        brick = persist.BRICKS[slug]
        self.response.write(brick.render_html_page())


@base.route('/')
class Profile(base.Handler):
    def get(self):
        brick = persist.BRICKS['profile']
        self.response.write(brick.render_html_page())
