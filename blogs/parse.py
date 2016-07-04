import markdown
import mdx_math

extensions = [mdx_math.makeExtension(enable_dollar_delimiter=True)]

some_text = """

[&aCommand(__a__=a, b=g)]{ a side g note [>]{recursive} }

[&asdf(a=a)]{ This is a thinger }

asdf asdf {}

 * Hello 1
 * Hello 1 [>]{asdf}
 * Hello 2

[>]{a side g note}


{{ hello }}

[>]{

    By functions we mean anything that we can represent on the mesh:
    return electrode at ($r_{s^-}$).

    For example:

        *

    [>]{A third}


    For example:

        *
}
"""


from pyparsing import *

SidenoteCommand = Forward()

def createArg(z):
    print z[0][0]
    return 'arg[{}, {}]'.format(z[0][0], z[0][1])


varName = Combine(
    Word(alphas + '_', exact=1) +
    ZeroOrMore(Word(alphanums + '_', exact=1))
)

kwarg = Group(varName + Suppress('=') + Word(alphas)).setParseAction(createArg)
customCommand = (
    Suppress("&") + varName +
    Group(Optional(
        Suppress('(') +
        Optional(delimitedList( kwarg )) +
        Suppress(')')
    ))
)

command =  customCommand | (Keyword(">").setParseAction(replaceWith("comment")) + Group(Optional(' ')))

mdObject = Forward()


def isNewLine(s):
    return s


def recurse(s, b, c):
    out = mdObject.parseString(c[0][1:-1])
    # print out
    return [out]


SidenoteCommand << Group(
    Group(Optional(Keyword('\n').leaveWhitespace())).setParseAction(isNewLine) +
    Suppress('[') + command + Suppress(']') + FollowedBy('{') +
    # Suppress('{') + Group(CharsNotIn("{}")) + Suppress('}')
    nestedExpr(opener='{', closer='}').setParseAction(keepOriginalText, recurse)
)

injector = Group(Suppress('{{') + Word(alphas) + Suppress('}}'))

text_block = Group(
    OneOrMore(Word("""0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ!"#$%&'(){}*+,-./:;<=>?@\^_`|~ \n"""))
)#.setParseAction(replaceWith('markdown'))

mdObject << ZeroOrMore(MatchFirst([SidenoteCommand, injector, text_block]))

import pprint
out = mdObject.parseString(some_text)
pprint.pprint(out.asList())

# print markdown.markdown(some_text, extensions=extensions)
