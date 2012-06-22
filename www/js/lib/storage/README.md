# Storage

Handles the storage abstraction. By default it uses
[lawnchair](https://github.com/brianleroux/lawnchair) for the abstraction, with the
following adapters built in:

* indexed-db: for the HTML5 future
* webkit-sqlite: for mobile webkits
* memory: for use when storage prompts are not desired.

It also includes an AMD define() wrapper via the lawnchair.pre and lawnchair.post files.

## How to build

This snapshot was taken from https://github.com/brianleroux/lawnchair/master
on June 5, 2012, last commit was:

https://github.com/brianleroux/lawnchair/commit/4aa88513ee95c7d83d03f8fdb2056cc6e77b34cb

How the lawnchair.js file was generated:

    volo add brianleroux/lawnchair/master
    cat lawnchair.pre lawnchair/src/Lawnchair.js lawnchair/src/adapters/memory.js lawnchair/src/adapters/webkit-sqlite.js lawnchair/src/adapters/indexed-db.js lawnchair.post > Lawnchair.js
    rm -rf ./lawnchair

