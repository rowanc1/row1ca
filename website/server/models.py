import properties
import datetime
from . import template

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


class Brick(properties.HasProperties):

    style = 'content'
    style_item = 'award'
    style_card = 'card'
    style_page = 'page-nested'

    uid = properties.String('unique id', regex='^' + RE_SLUG + '$')

    title = properties.String('title')
    description = properties.String('description')

    thumbnail = properties.String('description')

    date = properties.DateTime(
        'when brick was published',
        default=lambda: datetime.datetime.now()
    )

    tags = properties.List(
        'list of tags',
        prop=properties.String('', change_case='lower')
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
        min_length=1
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

    query_type = properties.StringChoice(
        'Kind of query',
        choices={'uid', 'kind', 'tags'}
    )

    query_kind = properties.StringChoice(
        'Kind of bricks to find',
        choices={'Award', 'Article'},
        required=False
    )

    query_uids = properties.List(
        'list of children uids',
        prop=properties.String('', regex='^' + RE_SLUG + '$'),
        required=False
    )

    query_tags = properties.List(
        'list of children uids',
        prop=properties.String('', change_case='lower'),
        required=False
    )

    @property
    def children(self):
        from . import persist
        if self.query_type == 'uid':
            q = persist.query_uids(self.query_uids)
        elif self.query_type == 'kind':
            q = persist.query_kind(self.query_kind)
        elif self.query_type == 'tags':
            q = persist.query_tags(self.query_tags)
        else:
            q = []
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


class Award(Brick):

    style_item = 'award'

    amount = properties.Float('amount of the award')
    level = properties.StringChoice(
        'level of the award',
        choices={'institutional', 'regional', 'national', 'international'}
    )
    declined = properties.Bool('Was the award declined?', default=False)
