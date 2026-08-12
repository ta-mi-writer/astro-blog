---
description: Rename the current Herdr agent pane to nemotron-blog
---

Please perform the following steps to rename this agent in Herdr:

1. Execute this command to list the agents and find the `PANE_ID` corresponding to the current pane:
   `herdr agent list`

2. Using the `PANE_ID` obtained from Step 1, run the following command to rename this Pi agent in Herdr to `nemotron-blog`:
   `herdr agent rename <PANE_ID> nemotron-blog`
