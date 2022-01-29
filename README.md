# community-paint-canvas
 
Donate to make your art show up: https://tiltify.com/@lumenwright/midwinter-magic-2022

# Database structure:
* pixels: a list of the current pixels on the canvas grouped by invoice id
- listed by id, then index in the HTML Canvas ImageData
* invoice: a list of the ids in the queue
- time: the time in human readable format
- heartbeat_time: epoch time
- text_response: the comment to match
* alphas: a list of the alpha values associated with each id
* queue: a list of the pixels with associated ids that are awaiting verification