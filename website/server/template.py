from jinja2_registry import Renderer, register_filesystem_loader

register_filesystem_loader('layouts', 'templates/layouts')
register_filesystem_loader('partials', 'templates/partials')
register_filesystem_loader('pages', 'templates/pages')
register_filesystem_loader('bricks', 'bricks')
