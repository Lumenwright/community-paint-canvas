import json

num_col = 10
num_row = 10

canvas =[]

#initialize with white pixels [r,g,b]

for j in range(num_col):
    row = []
    for i in range(num_row):
        row.append([255,255,255])
    canvas.append(row)

with open('canvas.json', 'w', newline='') as f:
    json.dump(canvas, f, separators=(',',':'))