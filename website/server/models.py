import properties

# starts with a letter, ends with a letter or number, can include hyphens
RE_SLUG = '[a-z]+[a-z0-9]+(?:-[a-z0-9]+)*'


class Contribution(properties.HasProperties):
    user = properties.String('Username of the contribution')
    kind = properties.StringChoice(
        'Kind of contribution',
        choices={'author', 'editor', 'reviewer'}
    )


class Thought(properties.HasProperties):

    uid = properties.String('unique id', regex='^' + RE_SLUG + '$')

    kind = properties.StringChoice(
        'Kind of the content',
        choices={'article'}
    )

    title = properties.String('title')
    description = properties.String('description')

    contributors = properties.List(
        'Contributors list',
        prop=properties.Instance('', instance_class=Contribution),
        min_length=1
    )

    date_published = properties.DateTime('when thought was published')

    license = properties.StringChoice(
        'license of content',
        choices={'CC-BY-4.0'}
    )

    tag = properties.List(
        'list of tags',
        prop=properties.String('', change_case='lower')
    )

    @property
    def content_url(self):
        """Location of the html file."""
        return 'thoughts/' + self.uid + '/content.html'
