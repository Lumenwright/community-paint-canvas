from typing import List, Text
from htmlBuilder.attributes import Class, Href, Rel, Style,Type, Id, Width, Height
from htmlBuilder.tags import Html, Head, Script, Title, Body, Div, Footer, Link
import canvas
import pixels

CANVAS_STYLE = "canvas.css"

def generate_html(canvas):
    html = Html([],
        Head([],[Link([Rel("stylesheet"),Type("text/css"), Href("style.css")]),
        Link([Rel("stylesheet"),Type("text/css"),Href(CANVAS_STYLE)]),
            Title([], "Community Paint Canvas")]
        ),
        Body([],
            [Div([Class("canvas")])
            ]
        )
    )

    return html.render(pretty=True, doctype=True) # pass doctype=True to add a document declaration

def generate_css(canvas):
    with open("index/canvas.css", 'w') as f:
        #w = "top: 0;\nleft: 0;\nright: 0;\nbottom: 0"
        w = "width: "+str(len(canvas))+"px;\nheight: "+str(len(canvas[0]))+"px;\n"
        s = ".canvas {\n"+w+"display: inline-block;\n"+"background-color:gold;\n"+"border: 10px solid grey;\n"+"}"
        f.write(s)

def reset_index():
    c = canvas.reset_canvas()
    generate_css(c)
    with open("index/index.html", 'w') as f:
        s = generate_html(c)
        f.write(s)

if(__name__ == "__main__"):
    reset_index()