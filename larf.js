const express = require("express");
const router = express.Router();
const async = require('async');
const path = require('path');
const fs = require("fs-extra");
const mime = require('mime-types');
const {
    IncomingForm
} = require('formidable');
const defaultConfig = require('./defaultConfigtion');
const api = require('./fileManager');

router.get('/', (req, res) => {
    res.status(200)
    res.send();
})

router.get('/initialize', (req, res) => {
    res.json(api.initialize());
})

router.get('/tree', (req, res) => {
    api.showDirectories(api.drive(req.query.disk), req.query.path).then((data) => {
        res.json(data);
    });
})

router.get('/content', (req, res) => {
    api.content(api.drive(req.query.disk), req.query.path)
        .then((data) => {
            res.send(data);
        })
})

router.get('/select-disk', (req, res) => {
    const hasDisk = defaultConfig.get('diskList').some((item) => {
        return item === api.drive(req.query.disk)
    })
    if (hasDisk) {
        return res.send({
            result: {
                status: 'success'
            }
        })
    }
    res.send({
        result: {
            status: 'danger'
        }
    })
});

router.get("/download", (req, res) => {
    defaultConfig.set('downloadDisk', req.query.disk);
    res.download(api.getFullPath(req.query.disk, req.query.path), err => {
        if (err) console.error(err);
    })
    if (req.aborted) {
        res.send(200);
    }
});

router.post('/zip', (req, res) => {
    req.on('data', (chunk) => {
        let data = "";
        data += chunk;
        data = JSON.parse(data);
        res.send({
            result: {
                status: 'success',
                message: 'This feature is not yet open, so stay tuned!'
            }
        })
    })
});

router.post('/unzip', (req, res) => {
    req.on('data', (chunk) => {
        let data = "";
        let dest = "";
        data += chunk;
        data = JSON.parse(data);
        dest = data.path.substring(0, data.path.lastIndexOf(path.sep));
        dest = data.folder ? path.join(dest, data.folder) : dest;
        res.send({
            result: {
                status: 'success',
                message: 'This feature is not yet open, so stay tuned!'
            }
        })
    })
})
router.post('/update-file', (req, res) => {
    const form = new IncomingForm({
        keepExtensions: true,
        maxFileSize: 1 * 1024 * 1024 * 1024,
        maxFields: 0, // default 1000,set 0 for unlimited
        maxFieldsSize: 20 * 1024 * 1024, //default
        hash: false, //default
    });
    form.uploadDir = path.join(api.drive(defaultConfig.get('downloadDisk')), 'tempfile');
    form.on('error', err => {
        console.error(err);
        res.send({
            result: {
                status: "danger",
                message: "An error occurred while updating!"
            }
        })
    });

    api.createDirectory(form.uploadDir).then(() => {
        form.parse(req, (err, fields, files) => {
            if (err) console.error(err);
            new Promise((resolve, reject) => {
                fs.rename(files.file.path, fields.path, (err) => {
                    if (err) {
                        return reject(err);
                    }
                    resolve(true);
                });
            }).then((result) => {
                if (result) {
                    api.updateProperty(fields.path).then((pro) => {
                        if (pro) {
                            res.send({
                                result: {
                                    status: 'success',
                                    message: 'update completed!'
                                },
                                file: result
                            })
                        } else {
                            res.send({
                                result: {
                                    status: 'danger',
                                    message: 'Update failed!'
                                }
                            })
                        }
                    })
                } else {
                    res.send({
                        result: {
                            status: 'danger',
                            message: 'Update failed!'
                        }
                    })
                }
            })

        })
    })
})
router.get("/thumbnails", (req, res) => {
    let currentPath = api.getFullPath(req.query.disk, req.query.path);
    (async () => {
        return await new Promise((resolve) => {
            let rs = fs.createReadStream(currentPath, {
                flags: 'r',
                fd: null,
                mode: 0666,
                autoClose: true
            });
            res.setHeader('content-type', mime.lookup(currentPath));
            rs.pipe(res);
            resolve();
        })
    })();
});

router.get("/preview", (req, res) => {
    let currentPath = api.getFullPath(req.query.disk, req.query.path);
    (async () => {
        return await new Promise((resolve) => {
            let rs = fs.createReadStream(currentPath, {
                flags: 'r+',
                fd: null,
                mode: 0666,
                autoClose: true
            });
            res.setHeader('content-type', mime.lookup(currentPath));
            rs.pipe(res);
            resolve();
        })
    })();
});
router.get('/stream-file', (req, res) => {
    let currentPath = api.getFullPath(req.query.disk, req.query.path);
    (async () => {
        return await new Promise((resolve) => {
            let rs = fs.createReadStream(currentPath, {
                flags: 'r+',
                fd: null,
                mode: 0666,
                autoClose: true
            });
            res.setHeader('content-type', mime.lookup(currentPath));
            res.setHeader('Accept-Ranges', 'bytes');
            rs.pipe(res);
            resolve();
        })
    })();
})
router.get('/url', (req, res) => {
    res.send({
        result: {
            status: "success",
            message: ""
        },
        url: "http://localhost:3000/" + req.query.path.split(path.sep).join("/")
    })
})
router.post('/create-file', (req, res) => {
    /**
     * 注册data事件接收数据
     * @param {string} chunk默认是一个二进制数据和data拼接会自动toString
     */
    req.on('data', (chunk) => {
        let data = "";
        let currentFile = "";
        data += chunk;
        data = JSON.parse(data);
        const reg = new RegExp('[\\\\/:*?\"<>|]');
        if (reg.test(data.name.toString())) {
            return res.send({
                result: {
                    'status': 'danger',
                    'message': "File creation failed, contains illegal characters \\\/:*?\"<>|"
                }
            });
        }
        if (data.name.toString().indexOf(".") === -1) {
            return res.send({
                result: {
                    'status': 'danger',
                    'message': "File creation failed, please add file extension!"
                }
            });
        }
        try {
            currentFile = data.path == null ? api.getFullPath(data.disk, data.name) : api.getFullPath(data.disk, path.join(data.path, data.name));
        } catch (error) {
            console.error(error)
        }
        async.waterfall([
            function (cb) {
                api.createFile(currentFile).then((data) => {
                    cb(null, data);
                });

            },
            function (isSuccess, cb) {
                if (isSuccess) {
                    api.fileInfo(currentFile).then((data) => {
                        return res.send({
                            result: {
                                'status': 'success',
                                'message': "File created successfully!"
                            },
                            file: data
                        })
                    })

                } else {
                    return res.send({
                        result: {
                            'status': 'danger',
                            'message': "File creation failed!"
                        }
                    });
                }
                cb(null)
            }
        ], (err, result) => {
            if (err) {
                console.error(err);
            }
        })
    })
});

router.post("/create-directory", (req, res) => {
    req.on('data', (chunk) => {
        let data = "";
        let currentFile = "";
        data += chunk;
        data = JSON.parse(data);
        try {
            currentFile = data.path == null ?
                api.getFullPath(data.disk, data.name) :
                api.getFullPath(data.disk, path.join(data.path, data.name));
        } catch (error) {
            console.error(error);
        }
        const reg = new RegExp('[\\\\/:*?\"<>|]');
        if (reg.test(data.name.toString())) {
            return res.send({
                result: {
                    'status': 'danger',
                    'message': "Directory creation failed, contains illegal characters \\\/:*?\"<>|"
                }
            });
        }
        api.createDirectory(currentFile).then((data) => {
            if (data) {
                api.fileInfo(currentFile).then((data) => {
                    return res.send({
                        result: {
                            'status': 'success',
                            'message': "The directory was created successfully!"
                        },
                        directory: data,
                        tree: [data]
                    })
                })
            } else {
                return res.send({
                    result: {
                        'status': 'danger',
                        'message': "Directory creation failed!"
                    }
                });
            }
        });
    })
});

/**
 * Delete Files
 */
router.post("/delete", (req, res) => {
    req.on("data", function (chunk) {
        let data = "";
        data += chunk;
        data = JSON.parse(data);
        new Promise((resolve) => {
            let delFileArr = data.items.map((obj) => {
                return {
                    path: api.getFullPath(data.disk, obj.path),
                    type: obj.type
                }
            })
            resolve(api.deleteAllFiles(delFileArr));
        }).then((result) => {
            if (result) {
                res.status(200);
                res.send({
                    result: {
                        'status': 'success',
                        'message': "The file has been successfully deleted!"
                    }
                });
            } else {
                res.status(200);
                res.send({
                    result: {
                        'status': 'danger',
                        'message': "File deletion failed!"
                    }
                });
            }
        }).catch(e => e)
    })
});

/**
 * copy and paste
 */
router.post('/paste', (req, res) => {
    req.on("data", (chunk) => {
        let data = "";
        data += chunk;
        data = JSON.parse(data);
        const isCut = data.clipboard.type === "cut";
        const promiseArr = [];
        let destDir = api.getFullPath(data.disk, data.path)
        if (isCut) {
            data.clipboard.directories.forEach(sourceDir => {
                folderName = path.basename(sourceDir);
                sourceDir = api.getFullPath(data.clipboard.disk, sourceDir);
                promiseArr.push(api.moveFolder(sourceDir, path.join(destDir, folderName)));
            });
            data.clipboard.files.forEach(sourceDir => {
                fileName = path.basename(sourceDir);
                sourceDir = api.getFullPath(data.clipboard.disk, sourceDir);
                promiseArr.push(api.moveFolder(sourceDir, path.join(destDir, fileName)));
            })
        } else {
            data.clipboard.directories.forEach(sourceDir => {
                folderName = path.basename(sourceDir);
                sourceDir = api.getFullPath(data.clipboard.disk, sourceDir);
                promiseArr.push(api.copySelectedFolder(sourceDir, path.join(destDir, folderName)));
            });
            data.clipboard.files.forEach(sourceDir => {
                fileName = path.basename(sourceDir);
                sourceDir = api.getFullPath(data.clipboard.disk, sourceDir);
                promiseArr.push(api.copySelectedFolder(sourceDir, path.join(destDir, fileName)));
            })
        }
        Promise.all(promiseArr).then((data) => {
            let isTrue = data.some(value => {
                return !Boolean(value)
            })
            if (isTrue) {
                res.status(200);
                res.send({
                    result: {
                        status: "danger",
                        message: isCut ? "File cut failed!" : "File copy failed!"
                    }
                })
                return;
            }
            res.status(200);
            res.send({
                result: {
                    status: "success",
                    message: isCut ? "File cut successfully!" : "File copied successfully!"
                }
            })
        })
    });
});
router.post("/rename", (req, res) => {
    req.on("data", (chunk) => {
        let data = "";
        data += chunk;
        data = JSON.parse(data);
        let oldName = api.getFullPath(data.disk, data.oldName)
        api.renameFile(data.newName, oldName).then((isSuccess) => {
            if (isSuccess) {
                res.status(200);
                res.send({
                    result: {
                        status: "success",
                        message: "Renamed successfully!"
                    }
                })
            } else {
                res.status(200);
                res.send({
                    result: {
                        status: "danger",
                        mesage: "Rename failed!"
                    }
                })
            }
        })
    })
});

router.post("/upload", (req, res, next) => {
    let savePath = ""; // The address of the current file to be stored
    let overwrite = 0; // Whether the file is overwritten, 0 means no, 1 means overwrite
    const fromPath = []; // Temporary file path
    const fileName = []; // Uploaded file name
    const form = new IncomingForm({
        multiples: true,
        encoding: 'utf-8',
        keepExtensions: true,
        maxFileSize: 1 * 1024 * 1024 * 1024,
        maxFields: 0, // default 1000,set 0 for unlimited
        maxFieldsSize: 20 * 1024 * 1024, //default
        hash: false, //default
    });
    form.uploadDir = api.selectedPath;
    form.on('error', (err) => {
        console.error(err);
        res.send({
            result: {
                status: "danger",
                message: "An error occurred while uploading!"
            }
        })
    });

    form.parse(req, (err, fields, files) => {
        let file = JSON.parse(JSON.stringify(files['files[]']));
        file = file instanceof Array ? file : [file];
        const renamePromiseArr = [];

        savePath = api.getFullPath(fields.disk, fields.path);
        overwrite = fields.overwrite;
        for (let index in file) {
            fileName[index] = (file[index]).name;
            fromPath[index] = (file[index]).path;
        }
        if (err) {
            console.error(err);
            return;
        }
        for (let index in fromPath) {
            renamePromiseArr.push(new Promise((resolve, reject) => {
                let toPath = path.join(savePath, fileName[index]);
                let suffix = 0;
                if (overwrite === '0') {
                    try {
                        if (fs.existsSync(toPath)) {
                            const files = fs.readdirSync(savePath);
                            for (let fname of files) {
                                if (fname.replace(/\(\d\)/g, "") === fileName[index]) ++suffix;
                            }
                            let name = fileName[index].indexOf(".") === -1 ? `${fileName[index]}(${suffix})` : fileName[index].split(".").join(`(${suffix}).`);
                            toPath = path.join(savePath, name);
                            suffix = 0;
                        }
                    } catch (error) {
                        console.error(error);
                    }
                }
                fs.rename(path.join(fromPath[index]), toPath, (err) => {
                    if (err) {
                        return reject(err);
                    }
                    resolve(true);
                });
            }).catch(e => e))
        }
        Promise.all(renamePromiseArr).then((result) => {
            if (result) {
                return res.send({
                    result: {
                        status: "success",
                        message: "Upload successfully!"
                    }
                })
            }
            res.send({
                result: {
                    status: "danger",
                    message: "upload failed!"
                }
            })
        })
    })
})

module.exports = router;