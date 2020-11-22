## larf NodeJS Connector

This is connector for vue-laravel-file-manager in node.js.

![larf](./tempfile/larf.gif)
The Aliyun Oss connector for this manager : https://github.com/refinec/larfoss-node

## Installation

```
npm install larf-node --save
```

## Usage

This package should be implemented as a middleware for Express.js server

```javascript
const express = require("express");
const app = express();
const larf = require("larf-node");

app.use('/', larf);
app.listen( process.env.PORT || 3000);
```

## Missing Features

Most of the larf function are working with the exception of these:

* ACL
* Compression and Decompression

