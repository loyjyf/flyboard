'use strict';var router = require('express').Router();module.exports = router;var bodyParser = require('body-parser');var blueBird = require('bluebird');var Record = require('../logicals/record');var DataSource = require('../logicals/dataSource');var Folder = require('../logicals/folder');router.get(    '/api/folders',    function (req, res, next) {        Folder.find().then(function (folders) {            if(!folders) {                return res.send(404);            }            res.send(folders);        }).catch(next);    });router.get(    '/api/folders/:id',    function(req, res, next){        var id = parseInt(req.param('id'), 10);        Folder.get(id).then(function (folder){            if(!folder){                return res.send(404);            }            res.send(folder);        }).catch(next);    });router.get(    '/api/folders/:parent_id/folders',    function(req, res, next){        var parentId = parseInt(req.param('parent_id'), 10);        if(!parentId) {            parentId = null;        }        Folder.find({            parent_id: parentId        }).then(function (folders){            if(!folders){                return res.send(404);            }            res.send(folders);        }).catch(next);    });router.post(    '/api/folders',    bodyParser.json(),    function(req, res, next){        var folder = req.body;        if(folder.name === undefined){            return res.send(400);        }        if(folder.parent_id){            Folder.get(folder.parent_id).then(function (folder) {                if(!folder) {                    return res.send(404);                }            });        }        Folder.save(folder).then(function (id) {            return Folder.get(id);        }).then(function (folder) {            res.send(folder);        }).catch(next);    });router.put(    '/api/folders/:id',    bodyParser.json(),    function (req, res, next) {        var folder = req.body;        if(!folder.name) {            res.send(400);        }        var id = parseInt(req.param('id', 10));        Folder.update(id, folder).then(function() {            return Folder.get(id);        }).then(function (folder) {            res.send(folder);        }).catch(next);    });router.delete(    '/api/folders/:id',    function(req, res, next) {        var id = parseInt(req.param('id'), 10);        var recursive = req.param('recursive') === 'true' || false;        function deleteFolderRecursive (id) {            return Folder.get(id)                .then(function (folder) {                    if(!folder) {                        return [];                    }                    var promises = [];                    var pros = [];                    //delete child folders                    promises = Folder.find({                        parent_id: folder.id                    }).then(function (folders) {                        return folders.map(function (subFolder) {                            // delete recursively                            return deleteFolderRecursive(subFolder.id);                        });                    });                    //delete child dataSources                    pros = DataSource.find({                        folder_id: folder.id                    }).then(function (dataSources) {                        return dataSources.map(function (dataSource) {                            var promises = Record.find({                                query: {                                    data_source_id: dataSource.id                                }                            }).then(function (records) {                                return records.map(function (record) {                                    return Record.remove(record.id);                                });                            });                            return blueBird.all(promises).then(function () {                                return DataSource.remove(dataSource.id);                            });                        });                    });                    return blueBird.all([blueBird.all(promises), blueBird.all(pros)]).then(function(){                        return Folder.remove(folder.id);                    });            });        }        if(!recursive) {            Folder.get(id).then(function (folder) {                if(!folder){                    return res.send(404);                }                var promises = [];                var pros = [];                //set parent of child folders to folder.parent_id                promises = Folder.find({                    parent_id: folder.id                }).then(function (folders) {                    return folders.map(function (subFolder) {                        subFolder.parent_id = folder.parent_id;                        return Folder.update(subFolder.id, subFolder);                    });                });                //set parent of child dataSources to folder.parent_id                pros = DataSource.find({                    folder_id: folder.id                }).then(function(dataSources) {                    return dataSources.map(function (dataSource){                        dataSource.folder_id = folder.parent_id;                        return DataSource.update(dataSource.id, dataSource);                    });                });                blueBird.all([blueBird.all(promises), blueBird.all(pros)]).then(function () {                    Folder.remove(id).then(function () {                        res.send(200, 'ok');                    }).catch(next);                });            });        }        else {            deleteFolderRecursive(id).then(function () {                res.send(200);            }).catch(next);        }    });