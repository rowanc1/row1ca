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

USERS = {
    "rowan": {
        "name": "Rowan Cockett",
        "institution": "row1"
    },
    "lindsey": {
        "name": "Lindsey Heagy",
        "institution": "UBC"
    },
    "doug": {
        "name": "Doug Oldenburg",
        "institution": "UBC"
    },
    "seogi": {
        "name": "Seogi Kang",
        "institution": "UBC"
    },
    "adam": {
        "name": "Adam Pidlisecky",
        "institution": "UCalgary"
    },
    "tara": {
        "name": "Tara Moran",
        "institution": "Stanford"
    },
    "eldad": {
        "name": "Eldad Haber",
        "institution": "UBC"
    },
    "gudni": {
        "name": "Gudni K.Rosenkjaer",
        "institution": "UBC"
    }
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


def _get_bricks(bricks):
    if bricks is None:
        return BRICKS
    if isinstance(bricks, list):
        return {brick.uid: brick for brick in bricks}
    return bricks


def query_user(uid):
    if uid not in USERS:
        return None
    return USERS[uid]


def query_kind(kind, bricks=None):
    bricks = _get_bricks(bricks)
    data = [bricks[b] for b in bricks if bricks[b].__class__.__name__ == kind]
    return sorted(data, key=lambda d: d.date.start, reverse=True)


def query_tags(tags, bricks=None):
    bricks = _get_bricks(bricks)
    data = [
        bricks[b] for b in bricks
        if len(set(bricks[b].tags).intersection(tags)) > 0
    ]
    return sorted(data, key=lambda d: d.date.start, reverse=True)


def query_uids(uids, bricks=None):
    bricks = _get_bricks(bricks)
    return [bricks[uid] for uid in uids if uid in SLUGS]
