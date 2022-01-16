from typing import List, Text
from htmlBuilder.attributes import Class, Href, Rel, Style,Type, Id
from htmlBuilder.tags import Html, Head, Script, Title, Body, Div, Footer, Link
import canvas
import pixels

def generate_html(canvas):
    html = Html([],
        Head([],[Link([Rel("stylesheet"),Type("text/css"), Href("style.css")]),
            Title([], "Community Paint Canvas")]
        ),
        Body([],
            [Div([Class("row")],
                [Div([Class("pixel"), Id("default") if px_y[pixels.GREEN_NAME] == 0.0 else Id("selected")], [])
                for px_y in px_x]
            )
            for px_x in canvas]
        )
    )

    return html.render(pretty=True, doctype=True) # pass doctype=True to add a document declaration

def reset_index():
    c = canvas.reset_canvas()
    with open("index/index.html", 'w') as f:
        s = generate_html(c)
        f.write(s)

if(__name__ == "__main__"):
    reset_index()