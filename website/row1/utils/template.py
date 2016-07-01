import os
import jinja2

_htmlFolder = os.sep.join(os.path.dirname(__file__).split('/')[:-2]) + '/html/'

JINJA_ENVIRONMENT = jinja2.Environment(
    extensions=['jinja2.ext.autoescape'],
    autoescape=False,
    loader=jinja2.FileSystemLoader(_htmlFolder))

# Add filters to the page below:
# JINJA_ENVIRONMENT.filters['function'] = function


def set(handler, template_values, templateFile):
    # add some defaults to the template values
    template_values['handler'] = handler
    template = JINJA_ENVIRONMENT.get_template(templateFile)
    handler.response.write(template.render(template_values))
