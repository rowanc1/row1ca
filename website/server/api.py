from __future__ import print_function

import json
from . import base
from . import persist
from . import models


def render_api_brief(brick):
    thumb_url = base.BASE_URL + brick.thumbnail if brick.thumbnail else None
    return {
        "uid": brick.uid,
        "title": brick.title,
        "description": brick.description,
        "links": {
            "self": base.BASE_URL + "/api/bricks/rowan/" + brick.uid,
            "html": base.BASE_URL + "/" + brick.uid,
            "thumbnail": thumb_url
        }
    }


@base.route('/api/bricks/rowan')
class BricksListApi(base.APIHandler):
    def get(self):
        self.response.headers.add_header('Access-Control-Allow-Origin', '*')
        self.response.headers.add_header('Content-Type', 'application/json')

        q = self.request.get('q')
        if q == '' or q is None:
            return self.response.write(json.dumps([
                render_api_brief(brick)
                for slug, brick in persist.BRICKS.items()
            ]))
        try:
            query = json.loads(q)
        except ValueError:
            return self.error422("Could not load JSON")

        if not len(query) == 1:
            return self.error422("Can only query by one field at a time.")
        key = query.keys()[0]
        data = query[key]

        if key not in base.QUERY_TYPES:
            return self.error422(
                "Query type must be in [" + ", ".join(base.QUERY_TYPES) + "]."
            )

        if key == "kind":
            if data not in base.KINDS:
                return self.error422(
                    "Query for kind must be in [" + ", ".join(base.KINDS) + "]"
                )
            bricks = persist.query_kind(data)

        elif key == "tag":
            if not isinstance(data, list):
                return self.error422(
                    "Tag query must be a list."
                )
            bricks = persist.query_tags(data)
        return self.response.write(json.dumps(
            [render_api_brief(b) for b in bricks]
        ))


@base.route('/api/bricks/rowan/<slug:' + models.RE_SLUG + '>')
class BricksApi(base.APIHandler):
    def get(self, slug):
        if slug not in persist.SLUGS:
            return self.error404()
        brick = persist.BRICKS[slug]
        self.response.headers.add_header('Access-Control-Allow-Origin', '*')
        self.response.headers.add_header('Content-Type', 'application/json')
        self.response.write(json.dumps(brick.render_json()))


@base.route('/api/<:.*>')
class Error404Api(base.APIHandler):
    def get(self, slug):
        return self.error404()
