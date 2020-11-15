const defaultConfig = require('./defaultConfigtion');
const fs = require('fs-extra');
const path = require('path');
const archiver = require('archiver');
const unzip = require('unzip');
const os = require('os');
const api = {
    currentDisk: null,
    selectedPath: null,
};

/**
 * Initialization program configuration
 */
api.initialize = function(){
    if (defaultConfig.get('routePrefix') !== '/') {
        return {
            'result': {
                'status': 'danger',
                'message': 'noConfig'
            }
        }
    }
    let config = {
        'acl': defaultConfig.get('acl'),
        'leftDisk': defaultConfig.get('leftDisk'),
        'rightDisk': defaultConfig.get('rightDisk'),
        'leftPath': defaultConfig.get('leftPath'),
        'rightPath': defaultConfig.get('rightPath'),
        'windowsConfig': defaultConfig.get('windowsConfig'),
        'hiddenFiles': defaultConfig.get('hiddenFiles'),
        'disks': (() => {
            if (os.type != 'Windows_NT') {
                let linuxRoot = {
                    'local': {
                        local: '/',
                        driver: 'local'
                    }
                };
                this.currentDisk = linuxRoot;
                return linuxRoot;
            }
            let disks = {},
                disksArr = Object.assign([], defaultConfig.get('diskList'));
            disks[/\w?/i.exec(disksArr[0])[0]] = {
                local: disksArr[0],
                driver: /\w?/i.exec(disksArr[0])[0]
            }
            disksArr.shift();
            for (let index in disksArr) {
                let driveLetter = '';
                driveLetter = /\w?/i.exec(disksArr[index])[0];
                disks[driveLetter] = {
                    local: disksArr[index],
                    driver: driveLetter
                }
            }
            this.currentDisk = disks;
            return disks;
        })()
    }
    return {
        'result': {
            'status': 'success',
            'message': null
        },
        'config': config
    }
};


/**
 * The left directory column shows all directories
 * @param {String} disk 
 * @param {String} dir 
 */
api.showDirectories = async function (disk = "", dir = "") {
    dir = dir.replace(/(\w)(:)/, ""); 
    const filesList = [];
    try {
        return new Promise((resolve) => {
            const currentDir = path.join(disk, dir);
            fs.readdir(currentDir, function (err, files) {
                files.forEach((item, index) => {
                    let tempDir = {};
                    try {
                        const fullPath = path.join(currentDir, item);
                        let stats;
                        try {
                            stats = fs.statSync(fullPath);
                        } catch (error) {}
                        if (!stats) { // Forbidden files are skipped
                            return;
                        }
                        if (stats.isDirectory()) {
                            tempDir.id = index;
                            tempDir.basename = item; 
                            tempDir.dirname = fullPath;
                            tempDir.path = os.type() == 'Windows_NT' ? fullPath.split(path.sep).slice(1).join('/') : fullPath; //路径
                            tempDir.type = "dir";
                            tempDir.props = {
                                hasSubdirectories: true,
                                subdirectoriesLoaded: false,
                                showSubdirectories: true
                            };
                            tempDir.parentId = index;
                            filesList.push(tempDir);
                        }
                    } catch (error_1) {
                        console.error(error_1);
                    }
                    if (index === files.length - 1) {
                        resolve({
                            result: {
                                'status': 'success',
                                'message': null
                            },
                            directories: filesList
                        });
                    }
                });
            });

        });
    } catch (err_1) {
        console.error(err_1);
    }
};

/**
 * content
 * @param {String} disk 
 * @param {String} dirPath 
 */
api.content = async function (disk = "", dirPath = "") {
    try {
        return new Promise((resolve) => {
            const dir = path.join(disk, dirPath.replace(/(\w)(:)/, ""));
            const directories = [];
            const file = [];
            this.selectedPath = dir;
            fs.readdir(dir, function (err, files) {
                if (!files.length) {
                    return resolve({
                        result: {
                            'status': 'success',
                            'message': "The directory is empty!"
                        },
                        directories: [],
                        files: []
                    });
                }
                let stats = null;
                files.forEach((item, index) => {
                    let tempDir = {};
                    try {
                        const fullPath = path.join(dir, item);
                        try {
                            stats = fs.statSync(fullPath);
                        } catch (error) {}
                        if (!stats) {
                            return;
                        }
                        tempDir.id = index;
                        tempDir.basename = item;
                        tempDir.dirname = fullPath;
                        tempDir.path = os.type() == 'Windows_NT' ? fullPath.split(path.sep).slice(1).join('/') : fullPath; //路径
                        tempDir.parentId = index;
                        tempDir.timestamp = stats.birthtimeMs / 1000;
                        tempDir.size = stats.size;
                        if (stats.isDirectory()) {
                            tempDir.type = "dir";
                            tempDir.props = {
                                hasSubdirectories: true,
                                subdirectoriesLoaded: false,
                                showSubdirectories: true
                            };
                            directories.push(tempDir);
                        } else {
                            tempDir.type = "file";
                            tempDir.extension = path.extname(item).slice(1);
                            tempDir.filename = path.basename(item, path.extname(item));
                            tempDir.props = {
                                hasSubdirectories: false,
                                subdirectoriesLoaded: true,
                                showSubdirectories: false
                            };
                            file.push(tempDir);
                        }
                    } catch (error_1) {
                        console.error(error_1);
                    }
                    if (index === files.length - 1) {
                        resolve({
                            result: {
                                'status': 'success',
                                'message': null
                            },
                            directories: directories,
                            files: file
                        });
                    }
                });
            });
        });
    } catch (err_1) {
        console.error(err_1);
    }
}

/**
 * Whether the file or folder exists
 * @param {String} dir 
 */
api.isExist = async function (dir) {
    try {
        return await new Promise((resolve) => {
            if (dir) {
                fs.exists(dir, (exists) => {
                    if (exists) {
                        return resolve(true);
                    }
                    return resolve(false);
                });
            } else {
                resolve(false);
            }

        });
    } catch (err) {
        console.error(err);
    }
}


/**
 * File or directory information
 * @param {String} dir 
 */
api.fileInfo = function (dir) {
    const tempDir = {};
    return new Promise((resolve) => {
        fs.lstat(dir, (err, stats) => {
            if (err) console.error(err);
            tempDir.path = dir;
            tempDir.timestamp = stats.ctimeMs / 1000;
            tempDir.size = stats.size;
            tempDir.basename = path.basename(dir);
            if (stats.isDirectory()) {
                tempDir.type = "dir";
                tempDir.props = {
                    hasSubdirectories: true,
                    subdirectoriesLoaded: false,
                    showSubdirectories: true
                };
                return resolve(tempDir);
            }
            tempDir.type = "file";
            tempDir.filename = path.basename(dir, path.extname(dir));
            tempDir.extension = path.extname(dir).slice(1);
            tempDir.props = {
                hasSubdirectories: false,
                subdirectoriesLoaded: true,
                showSubdirectories: false
            };
            return resolve(tempDir);
        })
    })
}

/**
 * Create a file
 * @param {String} dir 
 */
api.createFile = async function (dir = "") {
    try {
        const data = await this.isExist(dir);
        return new Promise((resolve) => {
            if (!data) {
                fs.writeFile(dir, "", (err) => {
                    if (err) {
                        return resolve(false);
                    }
                    resolve(true);
                });
            } else {
                resolve(false);
            }
        });
    } catch (err_1) {
        console.error(err_1);
    }
}

/**
 * New directory
 * @param {String} dir 
 */
api.createDirectory = function (dir = "") {
    return this.isExist(dir).then((data) => {
        return new Promise((resolve) => {
            if (!data) {
                fs.mkdir(dir, 0777, (err) => {
                    if (err) {
                        return resolve(false);
                    }
                    resolve(true);
                })
            } else {
                resolve(false);
            }
        })
    }).catch((err) => {
        console.error(err);
    })
}

/**
 * Update file
 * @param {string} dirname 
 * @param {ArrayBuffer} content 
 */
api.updateFile = async function (dirname, content) {
    return await new Promise((resolve, reject) => {
        let ws = fs.createWriteStream(dirname, {
            flags: 'w+',
            encoding: 'blob',
            fd: null, 
            mode: 0666,
            autoClose: true
        })
        ws.on('error', (err) => {
            reject(err);
        });
        ws.on('finish', () => {
            resolve(true);
        });
        ws.on('close', () => {
        });
        ws.write(content);
        ws.end();
    }).catch(e => e)
}

/**
 * Update file attributes
 * @param {String} dirname 
 */
api.updateProperty = async function(dirname) {
    return await this.isExist(dirname).then((result) => {
        if (result) {
            const tempDir = {};
            const item = dirname.substring(dirname.lastIndexOf(path.sep) + 1);
            try {
                const stats = fs.statSync(dirname);
                if (!stats) { // Forbidden files are skipped
                    return;
                }
                tempDir.path = os.type() == 'Windows_NT' ? dirname.split(path.sep).slice(1).join('/') : dirname;
                tempDir.basename = item;
                tempDir.dirname = dirname;
                tempDir.filename = path.basename(item, path.extname(item));
                tempDir.timestamp = stats.birthtimeMs / 1000;
                tempDir.size = stats.size;
                tempDir.type = "file";
                tempDir.extension = path.extname(item).slice(1);
                tempDir.props = {
                    hasSubdirectories: false,
                    subdirectoriesLoaded: true,
                    showSubdirectories: false
                };
                return tempDir;
            } catch (error) {
                console.error(error);
            }
        } else {
            return Promise.resolve(false);
        }
    })
}

/**
 * Delete Files
 * @param {Array} items 
 * @param {Array} promiseArr 
 */
api.deleteFiles = function (items = [], promiseArr = []) {
    if (items.length !== 0) {
        for (const pathObj of items) {
            promiseArr.push(new Promise((resolve, reject) => {
                const dirPath = pathObj.path || pathObj;
                fs.lstat(dirPath, (err, stats) => {
                    if (err) console.error(err);
                    if (stats.isDirectory()) {
                        resolve(new Promise((resolve) => {
                            const filesArr = fs.readdirSync(dirPath)
                            if (filesArr.length) {
                                for (const fileName of filesArr) {
                                    const currentItems = items.map((item) => {
                                        return path.join(dirPath, fileName)
                                    })
                                    return resolve(this.deleteFiles(currentItems, promiseArr));
                                }
                            } else {
                                fs.rmdir(dirPath, (err) => {
                                    if (err) {
                                        console.error(err);
                                        reject(false);
                                    }
                                    resolve(true); // Delete directory successfully
                                })
                            }
                        }).catch(e => e));
                    } else {
                        resolve(new Promise((resolve) => {
                            fs.unlink(dirPath, (err) => {
                                if (err) {
                                    console.error(err);
                                    reject(false); // Failed to delete file
                                }
                                resolve(true);
                            })
                        }).catch(e => e));
                    }
                })
            }).catch((err) => {
                console.error(err);
            }));
        }
        return promiseArr;
    }
    return [true];
}

/**
 * Delete a single file
 * @param {String} dirPath 
 */
api.deleteSingleFile = function (dirPath = "") {
    if (fs.existsSync(dirPath)) {
        if (fs.statSync(dirPath).isDirectory()) {
            // Delete the directory in the uploaded array
            fs.readdirSync(dirPath).forEach((item) => {
                const currentPath = path.join(dirPath, item);
                if (fs.statSync(currentPath).isDirectory()) {
                    return this.deleteSingleFile(currentPath);
                } else {
                    fs.unlinkSync(currentPath);
                }
            });
            fs.rmdirSync(dirPath);
        } else {
            // Delete files in the uploaded array
            fs.unlinkSync(dirPath);
        }
        return true;
    } else {
        return false;
    }
}

api.deleteAllFiles = function (items) {
    if (items.length !== 0) {
        try {
            items.forEach((pathObj) => {
                const dirPath = pathObj.path || pathObj;
                this.deleteSingleFile(dirPath)
            })
        } catch (error) {
            console.error(error);
            return false;
        }
        return true;
    }
    return true;
}

/**
 * Move directories and files
 * @param {string} srcFolder 
 * @param {string} destFolder 
 */
api.moveFolder = async function (srcFolder, destFolder) {
    try {
        await fs.move(srcFolder, destFolder, {
            overwrite: true
        });
        return true;
    } catch (error) {
        console.log(error);
        return false;
    }
}


/**
 * Copy all files and directories under a directory, copy files
 * @param {string} srcFolder 
 * @param {string} destFolder 
 */
api.copySelectedFolder = function (srcFolder, destFolder) {
    return new Promise((resolve, reject) => {
        fs.copy(srcFolder, destFolder, {
            preserveTimestamps: true
        }, (err) => {
            if (err) reject(err);
            resolve(true);
        })
    }).catch(e => console.error(e))
}

/**
 * Given a directory, copy the directory and the files in it
 * @param {string} srcDir 
 * @param {string} tarDir
 */
api.copyFolder = function (srcDir, tarDir, num, cb) {
    fs.readdir(srcDir, (err, files) => {
        fs.mkdir(tarDir, (err) => {
            if (err) cb && cb()
        })
        num[0]++;
        // Call back directly when empty directory
        files.length === 0 && cb && cb()
        let count = 0;
        let checkEnd = function () {
            ++count == files.length && cb && cb()
        }
        if (err) {
            checkEnd();
            return
        }
        files.forEach((file) => {
            let srcPath = path.join(srcDir, file);
            let tarPath = path.join(tarDir, file);
            fs.stat(srcPath, (err, stats) => {
                if (stats.isDirectory()) {
                    fs.exists(tarPath, (isHere) => {
                        if (isHere) return;
                        fs.mkdir(tarPath, (err) => {
                            if (err) {
                                return;
                            }
                            this.copyFolder(srcPath, tarPath, checkEnd);
                        })
                    })
                } else {
                    fs.copyFile(srcPath, tarPath, checkEnd)
                }
            })
        })

    })
}

api.renameFile = function(newName, oldName) {
    return new Promise((resolve, reject) => {
        try {
            let stats = fs.statSync(oldName);
            const fileName = path.basename(newName);
            const reg = new RegExp('[\\\\/:*?\"<>|]');
            const isValiate = reg.test(fileName);
            if (!isValiate) {
                newName = path.join(oldName.substring(0, oldName.lastIndexOf(path.sep)), fileName);
                if (stats.isDirectory()) {
                    fs.rename(oldName, newName, (err) => {
                        if (err) reject(err);
                        return resolve(true);
                    })
                }
                if (newName.indexOf(".") === -1) {
                    return resolve(false);
                }
                fs.rename(oldName, newName, (err) => {
                    if (err) reject(err);
                    return resolve(true);
                })
            }
            resolve(false);
        } catch (error) {
            console.error(error);
            resolve(false);
        }
    }).catch(e => e)
};
/**
 * Compressed file
 * @param {array} files 
 * @param {array} directories 
 * @param {string} dest 
 */
api.compressFile = async function(files = [], directories = [], dest) {
    return await new Promise((resolve, reject) => {
        if (!fs.existsSync(dest)) {
            fs.writeFileSync(dest);
        }
        let output = fs.createWriteStream(dest);
        let archive = archiver('zip', {
            store: true, // Sets the compression method to STORE.
            zlib: {
                level: 9
            } // Sets the compression level.
        });
        archive.on('error', (err) => reject(err));
        archive.on('close', () => resolve(true));
        archive.pipe(output);
        try {
            files.forEach((item) => {
                let name = path.basename(item);
                archive.directory(path.normalize(item + path.sep), name);
            })
            directories.forEach((item) => {
                let name = path.basename(item);
                archive.file(item, {
                    name
                })
            })

        } catch (error) {
            console.error(error);
        } finally {
            archive.finalize();
        }

    }).catch(e => e)
};

api.unzipFile = function(currentFile, dest) {
    return new Promise((resolve, reject) => {
        let rs = fs.createReadStream(currentFile).pipe(unzip.Extract({
            path: dest
        }));
        rs.on('error', (err) => reject(err));
        rs.on('end', () => {
            resolve(true)
        })
    }).catch(e => e)
};

/**
 * Return to the selected drive letter
 * @param {String} disk 
 */
api.drive = function(disk) {
    return this.currentDisk[disk].local;
};

/**
 * Get the full path of the file
 * @param {String} disk 
 * @param {String} path 
 * @return file path
 */
api.getFullPath = function(fdisk, fpath) {
    let currentDisk = this.drive(fdisk);
    return os.type() == 'Windows_NT' ? currentDisk + fpath.split('/').join(path.sep) : fpath;
};

module.exports = api;