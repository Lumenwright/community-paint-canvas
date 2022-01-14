from typing import List
from htmlBuilder.attributes import Class
from htmlBuilder.tags import Html, Head, Title, Body, Nav, Div, Footer, Ul, Li
import canvas

def generate_html(canvas: List):
    html = Html([],
        Head([],
            Title([], "Community Paint Canvas")
        ),
        Body([],
            [Div([],
                [Div([], str(px_y))
                for px_y in px_x]
            )
            for px_x in canvas]
        )
    )

    return html.render(pretty=True, doctype=True) # pass doctype=True to add a document declaration

def reset_index():
    c = canvas.reset_canvas()
    with open("index.html", 'w') as f:
        s = generate_html(c)
        f.write(s)