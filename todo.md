* match donation amount
* check time of donation is around time of submission
* make stream view that refreshes automatically
* change the way the total pixels are counted to the number of mouse move frames and not dependent on colour (and make sure current drawings aren't counted)
* make tiles and tile system
* erase/clear submission button
* reload/refresh button
* user feedback for clicking in mod view
* pause button
* clean up auth tokens etc.
* change from implicit to explicit oauth for login
* maybe require Twitch/some OAuth login and register a list of people who submitted pixels (restrict to subs/follows only?)
* make reset endpoint restricted - prompt to sign in with Twitch?
* clear/reset button for mod view
* save state history and be able to make a gif of it
* loading gif/screen while it loads canvas
* user confirmation e.g. on submit
* on exit should delete any remaining invoices
* donation time > time of submission
* copy button for description text to Tiltify comment
* separate backgrounds for stream view and user view
* host on the cloud
* display current visuals on user view
* investigate slowness on firefox
* pull and add descriptions to alt text of canvas
* add "contact if you're having trouble" button
* database index for comment history sorted by time
* connect default drawings to bits and channel point redemptions
* gif history view
* fade time adjusting at runtime on moderation
* manually match entries if needed in moderation view
* add name into matching
* make browser source transparent like now playing app

**Bugs**:
* approval queue if it's not matching still shows up in the mod screen after approval
* skips approval if the comment is identical to an existing donation
* have to refresh the login page a bunch of times
* moderation view undefined bug
* will match on any empty comment if the drawing comment is empty