from tokenize import Name
from turtle import width
from types import MethodDescriptorType
from htmlBuilder.attributes import Class, Href, Rel, Onclick,Type, Action, Src, Id, Width, Height, Name as N, Method, Value
from htmlBuilder.tags import Html, Head, Script, Title, Body, Div, Footer, Link,Canvas, Form, Input, Label
import canvas
from dont_commit import ID
import pixels

CANVAS_STYLE = "canvas.css"

def generate_html(canvas):
    readstr = "ReadCanvasData("+str(len(canvas))+","+str(len(canvas[0]))+")"
    html = Html([],
        Head([],[Link([Rel("stylesheet"),Type("text/css"), Href("style.css")]),
        Script([Type("text/javascript"), Href("canvas.json")]),
            Title([], "Community Paint Canvas")]
        ),
        Body([],
            [
            Canvas([Id("canvas"), Width(len(canvas)), Height(len(canvas[0])) ],"An interactive shared paint canvas"),
            Script([Src("script.js")]),
            Form([Id("Submission"),Action("/"), Method("POST")],[
                Label([],["Describe your drawing:"]),
                Input([Type("text"), Id("description"), N("description")]),
                Input([Type("hidden"), Id("numPx"), N("numPx"), Value(readstr)]),
                Input([Type("submit"),Id("submit_button"),N("submit"), Value("Submit"), Onclick("formSubmit()")])
            ])
            ]
            )
    )

    return html.render(pretty=True, doctype=True) # pass doctype=True to add a document declaration

def generate_css(canvas):
    num_row = len(canvas)
    num_col = len(canvas[0])
    with open("index/canvas.css", 'w') as f:
        w = "grid-template-rows: repeat("+str(num_row-1)+",1fr);\ngrid-template-columns: repeat("+str(num_col-1)+",1fr);\nmin-width:"+str(num_row)+"px;\nmin-height:"+str(num_col)+"px;"
        s = ".canvas {\n"+w+"display: grid;\nposition:relative;\nbackground-color:chartreuse;\nborder: 10px solid grey;\n}"
        f.write(s)

def reset_index():
    c = canvas.reset_canvas()
    #generate_css(c)
    with open("index/index.html", 'w') as f:
        s = generate_html(c)
        f.write(s)

if(__name__ == "__main__"):
    reset_index()