/*
Copyright 2017 apHarmony

This file is part of jsHarmony.

jsHarmony is free software: you can redistribute it and/or modify
it under the terms of the GNU Lesser General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

jsHarmony is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Lesser General Public License for more details.

You should have received a copy of the GNU Lesser General Public License
along with this package.  If not, see <http://www.gnu.org/licenses/>.
*/

var ejs = require('ejs');
var fs = require('fs');
var path = require('path');
var crypto = require('crypto');
var _ = require('lodash');
var async = require('async');
var HelperFS = require('jsharmony/HelperFS');
var Helper = require('jsharmony/Helper');

module.exports = exports = {};

/*******************
|    SCREENSHOTS   |
*******************/

exports.DEFAULT_SCREENSHOT_SIZE = [950, 700];
exports.HEADLESS = true;

exports.generateScreenshots = function(options,callback){
  var _this = this;
  var jsh = _this.jsh;
  _this.options = _.extend({
    screenshot_folder: path.join('public','screenshots'),
    targetTests: null,
    fileParams: null,
    doNotGenerateUnstableImages: false,
  }, options);

  var browserParams = { ignoreHTTPSErrors: true, ignoreDefaultArgs: [ '--hide-scrollbars' ] };
  if(!exports.HEADLESS) browserParams.headless = false;

  jsh.Extensions.report.getPuppeteer(function(err, puppeteer){
    if(err) return jsh.Log.error(err);
    puppeteer.launch(browserParams).then(function(browser){
      HelperFS.funcRecursive(_this.tutfolder,function(filepath, relativepath, file_cb){
        //For each File
        fs.readFile(filepath, 'utf8', function(err, txt){
          if(err) return file_cb(err);
  
          var screenshots = [];
    
          try{
            ejs.render(txt, { 
              req: null,
              getScreenshot: function(url, desc, params){ screenshots.push( { url: url, desc: desc, params: params } ); },
              instance: '',
              _: _
            });
          }
          catch(ex){ return file_cb(ex); }
  
          async.eachLimit(screenshots, 1, function(screenshot, screenshot_cb){
            _this.generateScreenshot(browser, screenshot.url, screenshot.desc, screenshot.params, screenshot_cb);
          }, function(err){
            if(err){ jsh.Log.error(err); }
            return file_cb();
          });
        });
      },undefined,undefined,function(err){
        if(err){ jsh.Log.error(err); }
        browser.close();
        return callback();
      });
    }).catch(function(err){ jsh.Log.error(err); });
  });
}

exports.generateScreenshot = function(browser, url, desc, params, callback){
  var _this = this;
  var jsh = _this.jsh;
  if(!url || (url[0] != '/')) url = '/' + url;
  var fname = this.getScreenshotFilename(url, desc, params);
  var fpath = _this.options.screenshot_folder;
  if(!path.isAbsolute(fpath)) fpath = path.join(_this.basepath, fpath);
  fpath = path.join(fpath, fname);

  //Do not generate screenshot if image already exists
  if(fs.existsSync(fpath)) return callback();

  if(_this.options.targetTests){
    if(!_.includes(_this.options.targetTests, fname)) return callback();
  }

  if (_this.options.fileParams){
    _this.options.fileParams[fname] = params;
  }

  if (_this.options.doNotGenerateUnstableImages && params && params.unstable){
    return callback();
  }

  var origParams = params||{};
  params = _.extend({ 
    x: 0, 
    y: 0, 
    width: _this.DEFAULT_SCREENSHOT_SIZE[0], 
    height: null,
    trim: true,
    resize: null, //{ width: xxx, height: yyy }
    postClip: null, //{ x: 0, y: 0, width: xxx, height: yyy }
    cropToSelector: null, //Selector
    onload: null,
    waitBeforeScreenshot: (exports.HEADLESS ? 150 : 1500),
    unstable: null, // screenshot has inconsistent elements, boolean, commonly a string naming the reason
  }, params);
  if(!params.browserWidth) params.browserWidth = params.x + params.width;
  if(!params.browserHeight) params.browserHeight = _this.DEFAULT_SCREENSHOT_SIZE[1];

  if(!params.onload) params.onload = function(){ return new Promise(function(resolve){ return resolve(); }); };
  
  var base_onload = params.onload;
  params.onload = function(){
    return new Promise(function(resolve){
      if(!window.jshInstance){ return base_onload().then(resolve); }
      var startTime = new Date().getTime();
      jshInstance.XExt.waitUntil(
        function(){ return jshInstance.init_complete; },
        function(){
          if(jshInstance) jshInstance.XWindowResize();
          return base_onload().then(resolve);
        },
        function(f){ if ((new Date().getTime() - startTime) > 5000) { f(); return false; } }
      );
    });
  }
  params.onload = Helper.ReplaceAll(params.onload.toString(), 'base_onload', '(' + base_onload.toString() + ')');
  eval('params.onload = ' + params.onload + ';');

  var getPageInfo = function(selector){
    document.querySelector('html').style.overflow = 'hidden';
    return new Promise(function(resolve){
      var pageSize = {
        pageWidth: document.body.scrollWidth,
        pageHeight: document.body.scrollHeight,
      };
      if(!selector) return resolve(pageSize);
      if(!jshInstance) return resolve(pageSize);
      var $ = jshInstance.$;
      pageSize = {
        pageWidth: $(document).width(),
        pageHeight: $(document).height(),
      }
      var jobjs = $(selector);
      if(!jobjs.length) return resolve(pageSize);
      var startpos = null;
      var endpos = null;
      for(var i=0;i<jobjs.length;i++){
        var jobj = $(jobjs[i]);
        var offset = jobj.offset();

        var offStart = { left: offset.left - 1, top: offset.top - 1 };
        var offEnd = { left: offset.left + 1 + jobj.outerWidth(), top: offset.top + 1 + jobj.outerHeight() };

        if(!startpos) startpos = offStart;
        if(offStart.left < startpos.left) startpos.left = offStart.left;
        if(offStart.top < startpos.top) startpos.top = offStart.top;

        if(!endpos) endpos = offEnd;
        if(offEnd.left > endpos.left) endpos.left = offEnd.left;
        if(offEnd.top > endpos.top) endpos.top = offEnd.top;
      }
      return resolve({
        cropRectangle: {
          x: startpos.left, 
          y: startpos.top, 
          width: endpos.left - startpos.left, 
          height: endpos.top - startpos.top,
        },
        pageWidth: pageSize.width,
        pageHeight: pageSize.height,
      });
    });
  }

  browser.newPage().then(function (page) {
    var port = jsh.Servers['default'].servers[0].address().port;
    var fullurl = 'http://localhost:'+port+url;
    console.log(_this.basepath + '/public/screenshots/'+fname);
    page.setViewport({ width: params.browserWidth, height: params.browserHeight }).then(function(){
      page.goto(fullurl, { waitUntil: 'networkidle0' }).then(function(){
        // text caret blinks, creating inconsistent screenshots
        page.addStyleTag({content: '* {caret-color: transparent !important;}'}).then(function() {
          page.evaluate(params.onload).then(function(){
            page.evaluate(getPageInfo, params.cropToSelector).then(function(pageInfo){
              //Apply height clipping using cropRectangle
              if(!pageInfo.cropRectangle){
                if(params.height){
                  pageInfo.cropRectangle = {
                    x: params.x,
                    y: params.y,
                    width: (origParams.width ? origParams.width : pageInfo.pageWidth),
                    height: params.height
                  };
                }
              }
              var takeScreenshot = function(){
                setTimeout(function(){
                  var screenshotParams = { path: fpath, type: 'png' };
                  if(pageInfo.cropRectangle) params.postClip = pageInfo.cropRectangle;
                  screenshotParams.fullPage = true;
                  page.screenshot(screenshotParams).then(function(){
                    _this.processScreenshot(fpath, params, function(err){
                      if(err) jsh.Log.error(err);
                      page.close().then(function () {
                        return callback();
                      }).catch(function (err) { jsh.Log.error(err); });
                    });
                  }).catch(function (err) { jsh.Log.error(err); });
                }, params.waitBeforeScreenshot);
              }
              if(params.beforeScreenshot){
                params.beforeScreenshot(jsh, page, takeScreenshot, pageInfo.cropRectangle);
              }
              else takeScreenshot();
            }).catch(function (err) { jsh.Log.error(err); });
          }).catch(function (err) { jsh.Log.error(err); });
        }).catch(function (err) { jsh.Log.error(err); });
      }).catch(function (err) { jsh.Log.error(err); });
    }).catch(function (err) { jsh.Log.error(err); });
  }).catch(function (err) { jsh.Log.error(err); });
}

exports.processScreenshot = function(fpath, params, callback){
  var _this = this;
  var jsh = _this.jsh;

  async.waterfall([
    function(img_cb){
      if(!params.postClip && !params.trim) return img_cb();
      var cropParams = [null, null, { resize: false }];
      if(params.postClip){
        cropParams[0] = params.postClip.width;
        cropParams[1] = params.postClip.height;
        cropParams[2].x = params.postClip.x;
        cropParams[2].y = params.postClip.y;
      }
      if(params.trim) cropParams[2].trim = true;
      jsh.Extensions.image.crop(fpath, fpath, cropParams, 'png', img_cb);
    },
    function(img_cb){
      if(!params.resize) return img_cb();
      var resizeParams = [params.resize.width||null, params.resize.height||null];
      jsh.Extensions.image.resize(fpath, fpath, resizeParams, 'png', img_cb);
    },
  ], function(err){
    return callback(err);
  });
}

exports.getScreenshot = function(url, desc, params){
  var fname = this.getScreenshotFilename(url, desc, params);
  return '<img class="screenshot" src="/screenshots/' + fname + '" />';
}

var maxLength = function(string, limit) {
  if (string.length > limit && limit > 10) {
    var hash = crypto.createHash('sha1').update(string).digest('base64url');
    return string.substring(0,limit-9) + '_' + hash.substring(0,8);
  } else {
    return string;
  }
}

exports.getScreenshotFilename = function(url, desc, params){
  if(!params) params = {};

  //Generate file name
  var fname = url || '';
  if(fname && (fname[0]=='/')) fname = fname.substr(1);
  if(fname && (fname.startsWith('jsHarmonyFactory'))) fname = 'F' + fname.substring(16);
  if(fname && (fname.startsWith('jsHarmonyTutorials'))) fname = 'T' + fname.substring(18);
  fname = maxLength(fname, 50) + '____' + maxLength(desc, 40);
  if(params.width) fname += '_' + params.width;
  if(params.height) fname += '_' + params.height;
  fname = fname.toString().replace(/[^a-zA-Z0-9]+/g, '_');
  fname = fname.replace(/\_+/g,'_');
  if(fname[0]=='_') fname = fname.substr(1);
  if(fname[fname.length-1]=='_') fname = fname.substr(0,fname.length-1);
  fname += '.png';
  return fname;
}
