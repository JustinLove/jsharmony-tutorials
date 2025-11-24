var _ = require('lodash');
var fs = require("fs");
var path = require("path");
var ejs = require('ejs');
var assert = require('assert');
var async = require('async');
var HelperFS = require('jsharmony/HelperFS');

var targetTests = null;
var fileParams = {};
var doNotGenerateUnstableImages = false;

var DO_NO_CLEAN_BEFORE_TEST = false;

//Parse command line arguments
for(var i=0;i<process.argv.length;i++){
  var arg = process.argv[i];
  if(arg == '--test'){
    targetTests = targetTests || [];
    if(process.argv.length >= i) i++;
    targetTests.push(process.argv[i]);
  }
  if(arg == '--do-not-generate-unstable-images'){
    doNotGenerateUnstableImages = true;
  }
}

let jsh = null;
let app_source_dir = path.normalize(process.cwd());
let app_source_data_dir = path.join(app_source_dir, 'data');
let test_dir = path.dirname(__filename);
let test_data_dir = path.join(test_dir,'data');
if(fs.existsSync(app_source_data_dir)) test_data_dir = path.join(app_source_data_dir,'test-screenshots');
let app_dir =  path.join(test_data_dir,'test-app');
let app_data_dir = path.join(app_dir,'data');
let result_file = path.join(test_data_dir,'screenshots.result.html');
let screenshots_source_dir = path.join(test_dir,'..','public','screenshots');
let screenshots_generated_dir = path.join(test_data_dir,'screenshots');
let screenshots_diff_dir = path.join(test_data_dir,'diff_screenshots');
let global_test_state = 'passed';

afterEach(function() {
  if (this.currentTest.state === 'failed') {
    global_test_state = 'failed';
  }
});

before(function(done) {
  this.timeout(1200000); // set test timeout long process to generate screenshots
  console.log('\n\rBefore Tests (Global)');
  //Remove data and screenshot folders
  if(!DO_NO_CLEAN_BEFORE_TEST){
    HelperFS.rmdirRecursiveSync(app_data_dir);
    HelperFS.rmdirRecursiveSync(screenshots_generated_dir);
    HelperFS.rmdirRecursiveSync(screenshots_diff_dir);
  }
  //Recreate data and screenshot folders
  HelperFS.createFolderRecursiveSync(test_data_dir);
  HelperFS.createFolderRecursiveSync(app_dir);
  HelperFS.createFolderRecursiveSync(app_data_dir);
  HelperFS.createFolderRecursiveSync(screenshots_generated_dir);
  HelperFS.createFolderRecursiveSync(screenshots_diff_dir);
  async.waterfall([
    //Copy data from current system
    function(cb){
      if(!fs.existsSync(app_source_data_dir)) return cb();
      if(path.normalize(app_source_data_dir) == path.normalize(test_data_dir)) return cb();
      if(path.normalize(app_source_data_dir) == path.normalize(app_data_dir)) return cb();
      HelperFS.copyRecursive(app_source_data_dir, app_data_dir,{ forEachDir: function(dirpath, targetpath, relativepath, cb){
        var curtargetpath = path.normalize(targetpath);
        if(dirpath.indexOf(app_data_dir) >= 0) return cb(false);
        if(dirpath.indexOf(test_data_dir) >= 0) return cb(false);
        //console.log(dirpath);
        //console.log(targetpath);
        return cb(true);
      } },cb);
    },
    //Initialize jsHarmony Config
    init_jsHarmony,
    //Start jsHarmony and generate screenshots
    start_jsHarmony,
  ],done)
});

after(function () {
  console.log('After Tests (Global) State: '+ global_test_state);
  if (global_test_state === 'passed') {
    setTimeout(function(){
      HelperFS.rmdirRecursiveSync(app_data_dir);
      HelperFS.rmdirRecursiveSync(screenshots_generated_dir);
      HelperFS.rmdirRecursiveSync(screenshots_diff_dir);
      HelperFS.rmdirRecursiveSync(path.join(test_dir,'test-app','models'));
    }, 1000);
  }
});

describe('Compare Screenshots', function() {
  it('public/screenshots should exist and have files', function() {
    checkDirectory(screenshots_source_dir);
  });

  it('test/screenshots should exist and have files', function() {
    checkDirectory(screenshots_generated_dir);
  });

  it('compare images', function(done) {
    this.timeout(600000);
    let files = fs.readdirSync(screenshots_source_dir);
    if(targetTests){
      files = _.filter(files, function(file){ return _.includes(targetTests, file); });
    }
    console.log('# of existing images to test '+files.length);
    console.log('# of generated images to test '+fs.readdirSync(screenshots_generated_dir).length);
    let failImages = [];
    async.eachLimit(files, 1, function(imageName, file_cb){
      if(fileParams[imageName] && fileParams[imageName].unstable){
        console.log('skipping comparison on unstable image: ', imageName);
        return file_cb();
      }
      if(!fs.existsSync(path.join(screenshots_generated_dir,imageName))){
        failImages[imageName]={name:imageName,reason:'New image was not generated'};
        return file_cb();
      }
      //Initial comparison
      compareScreenshots(imageName,0).then(function(isEqual){
        if (!isEqual){
          failImages[imageName]={name:imageName,reason: 'Images are not the same.'};
          //Rerun comparison with file parameter to generate image diff
          return compareScreenshots(imageName,{file: path.join(screenshots_diff_dir,imageName)}).then(function(){ return file_cb(); });
        }
        else return file_cb();
      }).catch(function(e){
        failImages[imageName]={name:imageName, reason: 'Comparison Error: '+e.toString()};
        //Rerun comparison with file parameter to generate image diff
        compareScreenshots(imageName,{file: path.join(screenshots_diff_dir,imageName)}).then(function(){ return file_cb(); }).catch(function(e){ return file_cb(); });
      });
    }, function(err){
      console.log('# fail: '+_.keys(failImages).length);
      generateFailImagesResultPage(failImages).then(function(html){
        fs.writeFile(result_file, html, function(err, data){
          if (err) console.log(err);
          console.log("Successfully Written to File.");
        });
        assert(_.keys(failImages).length===0,"Where "+_.keys(failImages).length+" generated images not equal. See differences <a href='"+result_file+"' >here</a>");
        return done();
      }).catch(done);
    });
  });
});

function checkDirectory(dir_name) {
  assert(fs.existsSync(dir_name),'Directory: '+dir_name+' does not exist');
  assert(fs.lstatSync(dir_name).isDirectory(),'Path: '+dir_name+' is not a directory');
  assert(fs.readdirSync(dir_name).length > 0,'Directory: '+dir_name+' is empty');
}

function generateFailImagesResultPage(failImages){
  return new Promise((resolve,reject)=>{
    ejs.renderFile(
      path.join(test_dir,'/views/test_results.ejs'),
      {
        screenshots_source_dir:screenshots_source_dir,
        screenshots_generated_dir: screenshots_generated_dir,
        screenshots_diff_dir:screenshots_diff_dir,
        failImages: failImages,
      },
      {},
      function(err, str){
        if(err) return reject(err);
        return resolve(str);
      }
    );
  })
}

function gmCompareImagesWrapper(srcpath, cmppath, options) {
  return new Promise((resolve, reject)=> {
    jsh.Extensions.image.getDriver(function(err, imageMagick){
      if(err) return reject(err);

      //Resized version of cmppath, to be the same size as srcpath
      let cmppath_resize = cmppath+'.resize.png';
      //Compare function
      let fcmp = function(_cmppath){
        if(!_cmppath) _cmppath = cmppath;
        imageMagick().compare(srcpath, _cmppath, options, function (err, isEqual, equality, raw) {
          if (err) return reject(err);
          return resolve(isEqual);
        });
      };
      //Check for differences without generating a difference image
      if(!options.file) return fcmp();
      else{
        try{
          //Get sizes of srcpath and cmppath
          var img1 = imageMagick(srcpath);
          var img2 = imageMagick(cmppath);
          img1.size(function(err,size1){
            if(err) return reject(err);
            img2.size(function(err,size2){
              if(err) return reject(err);
              //If srcpath and cmppath are the same size, generate the difference image
              if((size1.width==size2.width) && (size1.height==size2.height)) return fcmp();
              //Crop cmppath to be the same as srcpath, and save to cmppath_resize
              img2.autoOrient();
              img2.crop(size1.width,size1.height,0,0);
              img2.extent(size1.width,size1.height);
              img2.repage(0, 0, 0, 0);
              img2.noProfile().write(cmppath_resize, function(err){
                if(err) console.log(err);
                if(err) return reject(err);
                img2 = imageMagick(cmppath_resize);
                //Make sure that cmppath_resize is the same size as srcsize
                img2.size(function(err,size2){
                  if(err) return reject(err);
                  //Generate the difference image
                  if((size1.width==size2.width) && (size1.height==size2.height)) return fcmp(cmppath_resize);
                  return reject(new Error('Sizes still not the same after resize'));
                });
              });
            });
          });
        }
        catch(ex){
          return reject(ex);
        }
      }
    });
  });
}

function init_jsHarmony(cb) {
  async.waterfall([
    function(init_cb){
      //Copy app.config.js
      var fname = 'app.config.js';
      if(fs.existsSync(path.join(app_source_dir, fname))) return HelperFS.copyFile(path.join(app_source_dir, fname), path.join(app_dir, fname), init_cb);
      else return init_cb();
    },
    function(init_cb){
      //Copy app.config.local.js
      var fname = 'app.config.local.js';
      if(fs.existsSync(path.join(app_source_dir, fname))) return HelperFS.copyFile(path.join(app_source_dir, fname), path.join(app_dir, fname), init_cb);
      else return init_cb();
    },
  ], cb);
}

function start_jsHarmony(cb) {
  var jsHarmonyTutorials = require('./../index.js');
  jsh = new jsHarmonyTutorials.Application();
  jsh.Config.appbasepath = app_dir;
  jsh.Config.interactive = true;
  jsh.Config.debug_params.log_socket = false;
  jsh.Config.onServerReady.push(function () {
    if(jsh.Extensions.image.type != 'jsharmony-image-magick'){
      jsh.Servers['default'].Close();
      jsh.DB['default'].Close();
      return setTimeout(function(){ cb(new Error('Screenshot tests require jsharmony-image-magick extension')); }, 1000);
    }
    jsh.Modules.jsHarmonyTutorials.generateScreenshots({
      screenshot_folder: screenshots_generated_dir,
      targetTests: targetTests,
      fileParams: fileParams,
      doNotGenerateUnstableImages: doNotGenerateUnstableImages
    },function () {
      jsh.Servers['default'].Close();
      jsh.DB['default'].Close();
      cb();
    });
  });
  jsh.Run();
}

function compareScreenshots(imageName, options) {
  return gmCompareImagesWrapper(
    path.join(screenshots_source_dir,imageName),
    path.join(screenshots_generated_dir,imageName),
    options)
}
