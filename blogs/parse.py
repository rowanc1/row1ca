import markdown
import mdx_math

extensions = [mdx_math.makeExtension(enable_dollar_delimiter=True)]

some_text = """

[&asdf(a=a, b=g)]{ a side g note}

[&asdf(a=a, b=g)]{ This is a thinger}

asdf asdf

[>]{a side g note}


"""

from pyparsing import *

SidenoteCommand =  Forward()

def createArg(z):
    print z[0][0]
    return 'argument'

argument = Group(Word(alphas) + Suppress('=') + Word(alphas)).setParseAction(createArg)
customCommand = (
    Suppress("&") + Word(alphas) +
    Group(Optional(
        Suppress('(') +
        Optional(delimitedList( argument )) +
        Suppress(')')
    ))
)

command = customCommand | Keyword(">").setParseAction(replaceWith("comment"))

SidenoteCommand << Group(
    Suppress('[') + command + Suppress(']') +
    Suppress('{') + CharsNotIn("}") + Suppress('}')
)

mdObject = Forward()
mdObject << ZeroOrMore(SidenoteCommand | Word(printables))


print mdObject.parseString(some_text)

print markdown.markdown(some_text, extensions=extensions)
