# 0AD_node_map_util

## How to Install:

- Install Node 10+
- Place both bootstrap.js and package.json inside maps/random folder.
- Inside maps/random folder, run npm install.
- Finally, run 'node ./bootstrap.js' to run.

## Current maps supported:

- aegean_sea

I started implementing by running that script.

## The Problem:

It looks like Node's vm functionality to sandbox scripts really doesn't
appreciate scripts accessing global scope. There are articles demonstrating
this with simple examples: e.g. https://60devs.com/executing-js-code-with-nodes-vm-module.html

At the moment, I'm not sure how to deal with this.
