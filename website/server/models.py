import properties
import datetime
from . import template
from six import string_types

# starts with a letter, ends with a letter or number, can include hyphens
# RE_SLUG = '[a-z]+[a-z0-9]+(?:-[a-z0-9]+)*'
RE_SLUG = '[a-z0-9]+(?:-[a-z0-9]+)*'


class Contribution(properties.HasProperties):
    user = properties.String('Username of the contribution')
    kind = properties.StringChoice(
        'Kind of contribution',
        choices={'author', 'editor', 'reviewer'}
    )

    @property
    def profile(self):
        from . import persist
        return persist.query_user(self.user)


class DateRange(properties.HasProperties):
    start = properties.DateTime(
        "start of range",
        default=datetime.datetime.now
    )
    end = properties.DateTime(
        "end of range",
        required=False
    )

    @classmethod
    def deserialize(cls, value, trusted=False, verbose=True, **kwargs):
        """Create a dict of start and end to pass onto the instance."""
        if isinstance(value, (datetime.datetime, string_types)):
            value = dict(start=value)
        elif isinstance(value, (list, tuple)):
            if len(value) == 1:
                value = dict(start=value[0])
            elif len(value) == 2:
                value = dict(start=value[0], end=value[1])
        return super(DateRange, cls).deserialize(
            value, trusted=trusted, verbose=verbose, **kwargs
        )

    def strftime(self, *args, **kwargs):
        if self.end is None:
            return self.start.strftime(*args, **kwargs)
        return "{} - {}".format(
            self.start.strftime(*args, **kwargs),
            self.end.strftime(*args, **kwargs)
        )


class Brick(properties.HasProperties):

    style = 'content'
    style_item = 'award'
    style_card = 'card'
    style_page = 'page-nested'

    uid = properties.String('unique id', regex='^' + RE_SLUG + '$')

    title = properties.String('title')
    description = properties.String('description')

    thumbnail = properties.String('description')
    thumbnail_contain = properties.Boolean(
        'Contain thumbnail in cards.',
        default=False,
        required=False
    )

    date = properties.Instance(
        "when brick was published",
        DateRange,
        default=lambda: dict(start=datetime.datetime.now())
    )

    tags = properties.List(
        'list of tags',
        prop=properties.String('', change_case='lower'),
        default=[]
    )

    license = properties.StringChoice(
        'license of content',
        choices={'CC-BY-4.0'}
    )

    url_more = properties.String(
        'url to see more information',
        required=False,
        default=''
    )

    def render_json(self):
        return self.serialize()

    def render_html(self):
        return self.render_html_item()

    def render_html_item(self):
        renderer = template.Renderer('bricks/' + self.style_item + '.html')
        renderer.update({
            'brick': self
        })
        return renderer.render()

    def render_html_card(self):
        renderer = template.Renderer('bricks/' + self.style_card + '.html')
        renderer.update({
            'brick': self
        })
        return renderer.render()

    def render_html_page(self):
        renderer = template.Renderer('bricks/' + self.style_page + '.html')
        renderer.update({
            'brick': self
        })
        return renderer.render()


class Content(Brick):

    style_page = 'page-content'
    style_item = 'content'

    def render_html(self):
        """Location of the html file."""
        with open('content/' + self.uid + '/content.html', 'r') as f:
            return f.read()


class Article(Brick):

    style_page = 'page-article'

    contributors = properties.List(
        'Contributors list',
        prop=properties.Instance('', instance_class=Contribution),
        min_length=1,
        default=[]
    )

    @property
    def authors(self):
        import json
        return json.dumps(
            [c.profile for c in self.contributors if c.kind == 'author']
        )

    def render_html(self):
        """Location of the html file."""
        with open('content/' + self.uid + '/content.html', 'r') as f:
            return f.read()


class Collection(Brick):

    style_page = 'page-collection'

    query_type = properties.List(
        'Kind of query',
        properties.StringChoice(
            "",
            choices={'uid', 'kind', 'tags'}
        ),
        coerce=True,
        default=[]
    )

    query_kind = properties.StringChoice(
        'Kind of bricks to find',
        choices={'Article', 'CvAward', 'CvItem'},
        required=False
    )

    query_uids = properties.List(
        'list of children uids',
        prop=properties.String('', regex='^' + RE_SLUG + '$'),
        required=False,
        default=[]
    )

    query_tags = properties.List(
        'list of children tags',
        prop=properties.String('', change_case='lower'),
        required=False,
        default=[]
    )

    query_limit = properties.Integer(
        "limit the number of query results returned",
        default=-1
    )

    @property
    def children(self):
        from . import persist

        def query(query_type, bricks=None):
            if query_type == 'uid':
                q = persist.query_uids(self.query_uids, bricks=bricks)
            elif query_type == 'kind':
                q = persist.query_kind(self.query_kind, bricks=bricks)
            elif query_type == 'tags':
                q = persist.query_tags(self.query_tags, bricks=bricks)
            else:
                q = []
            return q

        q = None
        for query_type in self.query_type:
            print(query_type, q)
            q = query(query_type, bricks=q)

        # this is silly should happen first
        if q and self.query_limit >= 0:
            return q[:self.query_limit]

        return q

    def render_html(self):
        """Location of the html file."""
        renderer = template.Renderer('bricks/' + self.style + '.html')
        renderer.update({
            'brick': self
        })
        return renderer.render()


class CollectionItems(Collection):

    style = 'collection-items'
    style_page = 'page-collection-items'


class CollectionCards(Collection):

    style = 'collection-cards'
    style_page = 'page-collection-cards'


class CvItem(Brick):
    style_item = 'cv-item'

    duties = properties.List("", prop=properties.String(""), default=[])

    def render_html(self):
        if len(self.duties) == 0:
            return ''
        return '<ul>\n{}\n</ul>'.format(
            '\n'.join(
                ['<li>\n{}\n</li>'.format(c) for c in self.duties]
            )
        )


class CvAward(CvItem):

    style_item = 'cv-award'

    amount = properties.Float('amount of the award')
    level = properties.StringChoice(
        'level of the award',
        choices={'institutional', 'regional', 'national', 'international'}
    )
    declined = properties.Bool('Was the award declined?', default=False)


class Quote(Brick):
    style_item = 'ink-quote'

    quote = properties.String('quote')
    author = properties.String('Author of the quote.')
