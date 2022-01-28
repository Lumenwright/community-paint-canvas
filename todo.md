* match donation amount
* make stream view that refreshes automatically
* change the way the total pixels are counted to the number of mouse move frames and not dependent on colour (and make sure current drawings aren't counted)
* make tiles and tile system
* erase/clear submission button
* reload/refresh button
* clean up auth tokens etc.
* make reset endpoint restricted - prompt to sign in with Twitch?
* clear/reset button and approve/reject buttons for mod view
* save state history and be able to make a gif of it
* loading gif/screen while it loads canvas
* user confirmation e.g. on submit
* on exit should delete any remaining invoices
* donation time > time of submission
* copy button for description text to Tiltify comment
* check the comment in the donation *contains* the description text rather than matching exactly
* separate backgrounds for stream view and user view
* host on the cloud
* display current visuals on user view
* investigate slowness on firefox
* store the time and x/y coords of every mouse move and recreate the strokes on screen
* pull and add descriptions to alt text of canvas
* add "contact if you're having trouble" button
* database index for comment history sorted by time
* connect default drawings to bits and channel point redemptions

**Bugs**:
* can't do multiple invoice entries
* polling doesn't stop when all invoices are resolved
* prevent multiple submissions of the same set of pixels