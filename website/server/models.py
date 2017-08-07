import properties
from . import template

# starts with a letter, ends with a letter or number, can include hyphens
RE_SLUG = '[a-z]+[a-z0-9]+(?:-[a-z0-9]+)*'


class Contribution(properties.HasProperties):
    user = properties.String('Username of the contribution')
    kind = properties.StringChoice(
        'Kind of contribution',
        choices={'author', 'editor', 'reviewer'}
    )


class Brick(properties.HasProperties):

    page_style = 'page-nested'
    item_style = None

    uid = properties.String('unique id', regex='^' + RE_SLUG + '$')

    title = properties.String('title')
    description = properties.String('description')

    date = properties.DateTime('when brick was published')

    tag = properties.List(
        'list of tags',
        prop=properties.String('', change_case='lower')
    )

    license = properties.StringChoice(
        'license of content',
        choices={'CC-BY-4.0'}
    )


    def render_html_item(self):
        renderer = template.Renderer('bricks/' + self.item_style + '.html')
        renderer.update({
            'brick': self
        })
        return renderer.render()

    @property
    def html_content(self):
        return self.render_html_item()

    def render_html_page(self):
        renderer = template.Renderer('bricks/' + self.page_style + '.html')
        renderer.update({
            'brick': self
        })
        return renderer.render()


class Content(Brick):

    page_style = 'page-content'
    item_style = 'content'

    @property
    def html_content(self):
        """Location of the html file."""
        with open('content/' + self.uid + '/content.html', 'r') as f:
            return f.read()


class Article(Brick):

    page_style = 'page-article'
    item_style = 'card'

    contributors = properties.List(
        'Contributors list',
        prop=properties.Instance('', instance_class=Contribution),
        min_length=1
    )

    @property
    def html_content(self):
        """Location of the html file."""
        with open('content/' + self.uid + '/content.html', 'r') as f:
            return f.read()


class Collection(Brick):

    page_style = 'page-collection'

    @property
    def children(self):
        from . import persist
        q = persist.query_kind('Award')
        return q


class CollectionList(Brick):

    page_style = 'page-collection'

    children_uids = properties.List(
        'list of children uids',
        prop=properties.String('', regex='^' + RE_SLUG + '$')
    )

    @property
    def children(self):
        from . import persist
        q = persist.query_uids(self.children_uids)
        return q


class CollectionFeatured(CollectionList):
    page_style = 'page-nested'
    item_style = 'collection-featured'

    url_more = properties.String('pointer to more content')


class Award(Brick):

    item_style = 'award'

    amount = properties.Float('amount of the award')
    level = properties.StringChoice(
        'level of the award',
        choices={'institutional', 'regional', 'national', 'international'}
    )
    declined = properties.Bool('Was the award declined?', default=False)
