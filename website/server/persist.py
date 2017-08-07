import os
import json
from . import models

SLUGS = {
    _ for _ in os.listdir('./content')
    if os.path.isdir('./content/' + _)
}


def get_info(slug):
    with open('./content/' + slug + '/info.json', 'r') as f:
        data = json.loads(f.read())
        return models.Brick.deserialize(data, trusted=True)

BRICKS = {
    slug: get_info(slug) for slug in SLUGS
}


def load_json():
    global BRICKS, SLUGS
    JSON = {
        _ for _ in os.listdir('./content')
        if _.endswith('.json')
    }

    for doc in JSON:
        with open('./content/' + doc, 'r') as f:
            data = json.loads(f.read())
            assert isinstance(data, list)
            for item in data:
                brick = models.Brick.deserialize(item, trusted=True)
                SLUGS.add(brick.uid)
                BRICKS[brick.uid] = brick

load_json()

del get_info, load_json


def query_kind(kind):
    data = [BRICKS[b] for b in BRICKS if BRICKS[b].__class__.__name__ == kind]
    return sorted(data, key=lambda d: d.date, reverse=True)


def query_uids(uids):
    return [BRICKS[uid] for uid in uids if uid in SLUGS]
