---
description: Retrieve the PANE_ID of a specified Pi agent in the current Herdr environment, start a new session for that agent, and then rename the agent in Herdr.
---

Execute the following commands in order.

- Retrieve the PANE_ID

  - `herdr agent list | jq -r '.result.agents[] | select(.name=="kimi") | .pane_id'`

- Start a new session for the Pi agent

  - `herdr agent prompt kimi "/new"`

- Using the PANE_ID retrieved in the first step, rename the corresponding Pi agent in Herdr

  - `herdr agent rename <PANE_ID> kimi`

---
