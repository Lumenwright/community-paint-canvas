from htmlBuilder.attributes import Class, Href, Rel, Style,Type, Onclick, Src, Id
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
            [Div([Class("canvas"), Id("canvas")]),
            Script([Src("script.js")])
            ]
        )
    )

    return html.render(pretty=True, doctype=True) # pass doctype=True to add a document declaration

def generate_css(canvas):
    with open("index/canvas.css", 'w') as f:
        w = "grid-template-rows: repeat("+str(len(canvas))+",1px);\ngrid-template-columns: repeat("+str(len(canvas[0]))+",1px);\n"
        s = ".canvas {\n"+w+"display: grid;\n"+"background-color:chartreuse;\n"+"border: 10px solid grey;\n"+"}"
        f.write(s)

def reset_index():
    c = canvas.reset_canvas()
    generate_css(c)
    with open("index/index.html", 'w') as f:
        s = generate_html(c)
        f.write(s)

if(__name__ == "__main__"):
    reset_index()