
some_text = """

[&aCommand(__a__=a, b=g)]{ a side g note [>]{recursive} }

asdf

[&asdf(a=a)]{ This is a thinger }

asdf asdf {}

 * Hello 1
 * Hello 1 [>]{asdf}
 * Hello 2

[>]{a side g note `hello world`}



----

[>]{

    By functions we mean anything that we can represent on the mesh:
    return electrode at ($r_{s^-}$).

    For example

        *

    [>]{A third}


    For example:

* asdf
}
"""

some_other_text = """

This blog post shows a few different types of content that's supported and styled with Bootstrap. Basic typography, images, and code are all supported.

----

## Header 1

> Curabitur blandit tempus porttitor. **Nullam quis risus eget urna mollis** ornare vel eu leo. Nullam id dolor id nibh ultricies vehicula ut id elit.


[>]{
Cum sociis natoque penatibus et magnis dis parturient montes, nascetur ridiculus mus.

`Example code block`
}


"""

import os

# os.path.insert(1, os.path.join(os.path.abspath('.'), 'lib'))

import xmd
import pprint
out = xmd.parse(some_other_text)
# print out.asList()
# print '\n'.join([x.render() for x in out.asList()])

out = xmd.parse_file('blogs/finite_volume/finite_volume.xmd')
print '\n'.join([x.render() for x in out.asList()])
