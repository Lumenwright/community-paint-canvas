* fix pixel selection to be one at a time (if already selected, dont make another pixel)
* fix pixels to be on the grid exactly not overlapping
* pixel fadeout
* hook up to back end
* create pixel on mouse down not on click (paint view)
* generate canvas from previous state
* make stream view that refreshes automatically
* form for submitting pixels
* make tiles and tile system
* reload/refresh button
* clear/reset button and approve/reject buttons for mod view
* save state history and be able to make a gif of it
* authenticate that the client sent the json
* on exit should delete any remaining invoices
* donation time > time of submission
* copy button for description text to Tiltify comment
* if a pixel is already on then it shouldn't cost anything? unless we have the fadeout
* check the comment in the donation *contains* the description text rather than matching exactly
* separate backgrounds for stream view and user view
* host on the cloud

**Bugs**:
* can't do multiple invoice entries
* polling doesn't stop when all invoices are resolved
* prevent multiple submissions of the same set of pixels