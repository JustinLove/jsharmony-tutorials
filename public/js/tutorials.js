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

var jsHarmonyTutorials = function(jsh){
  this.jsh = jsh;
  this.tutorials = {};
  this.tutorialIDs = {};
  this.tutorialsMenu = {};
  this.tutorialsLOV = [];
}

jsHarmonyTutorials.prototype.Init = function(config){
  var _this = this;
  var jsh = _this.jsh;
  var XDom = jsh.XDom;
  var _ = jsh._;
  var moment = jsh.moment;
  var XForm = jsh.XForm;
  var XExt = jsh.XExt;

  for(var key in config) if(key in _this) _this[key] = config[key];
  var tutorials = this.tutorials;
  var tutorialIDs = this.tutorialIDs;
  var tutorialsMenu = this.tutorialsMenu;
  var tutorialsLOV = this.tutorialsLOV;

  var curTutorial = null;

  function getAnchorID(txt){
    var rslt = (txt||'').toLowerCase().replace(/[\W_]+/g,' ').trim();
    rslt = rslt.replace(/ /g,'_');
    while(rslt.indexOf('__')>=0) rslt = rslt.replace(/\_\_/g,'_');
    return rslt;
  }

  function genTutorialsLOV(lov,menu,parentid){
    for(var f in menu){
      var node = {};
      node[jsh.uimap.code_id] = lov.length+1;
      node[jsh.uimap.code_parent_id] = parentid;
      node[jsh.uimap.code_val] = f;
      node[jsh.uimap.code_txt] = f;
      node[jsh.uimap.code_icon] = 'folder';
      //node[jsh.uimap.codeseq] = lov.length+1;
      lov.push(node);
      if(menu[f]=='PAGE'){
        var tutobj = tutorials[f];
        node[jsh.uimap.code_txt] = tutobj.Title;
        node[jsh.uimap.code_icon] = 'file';
      }
      else {
        genTutorialsLOV(lov,menu[f],node[jsh.uimap.code_id]);
      }
    }
  }

  function onLayout(){
    var wh = window.innerHeight;
    var ww = window.innerWidth;

    var xdtutorials_menu = jsh.xd('.tutorials_menu');
    var xdtutorials_body = jsh.xd('.tutorials_body');
    var xdtutorial_tabs_body = jsh.xd('.tutorial_tabs_body');

    var menupadding = XExt.getPadding(xdtutorials_menu.element);
    var menuborder = XExt.getBorder(xdtutorials_menu.element);
    var menuh = wh - jsh.xd(".xhead").calc.height() - menupadding.top - menupadding.bottom - menuborder.top - menuborder.bottom;
    xdtutorials_menu.style.height = menuh+'px';

    var bodypadding = XExt.getPadding(xdtutorials_body.element);
    var bodyborder = XExt.getBorder(xdtutorials_body.element);
    var bodyh = wh - jsh.xd(".xhead").calc.height() - bodypadding.top - bodypadding.bottom - bodyborder.top - bodyborder.bottom;
    xdtutorials_body.style.height = bodyh+'px';
    var bodyw = ww - bodypadding.left - bodypadding.right - bodyborder.left - bodyborder.right - xdtutorials_menu.calc.widthToBorder();
    xdtutorials_body.style.width = bodyw+'px';

    var tutorialpadding = XExt.getPadding(xdtutorial_tabs_body.element);
    var tutorialborder = XExt.getBorder(xdtutorial_tabs_body.element);
    var tutorialh = bodyh - jsh.xd('.tutorial_title').calc.heightToBorder() - jsh.xd('.tutorial_tabs').calc.heightToBorder();
    tutorialh = tutorialh - tutorialpadding.top - tutorialpadding.bottom - tutorialborder.top - tutorialborder.bottom;
    xdtutorial_tabs_body.style.height = tutorialh+'px';
  }

  _this.onTutorialSelected = function(nodeid, ctrl){
    var nodeidx = parseInt(nodeid)-1;
    var node = tutorialsLOV[nodeidx];
    var orignode = node;
    if(node[jsh.uimap['code_icon']]=='folder'){
      //Find first file in that folder
      for(;nodeidx<tutorialsLOV.length;nodeidx++){
        node = tutorialsLOV[nodeidx];
        if(node[jsh.uimap['code_icon']]=='file') break;
      }
      if(node[jsh.uimap['code_icon']]=='folder') return;
    }
    var xdtutorials_menu = jsh.xd('.tutorials_menu');
    var xdnodectrl = xdtutorials_menu.get('.tree_item.tree_item_' + nodeid);
    if(xdnodectrl.length) XExt.scrollObjIntoView(xdtutorials_menu.element, xdnodectrl.element);
    if(curTutorial && (curTutorial.id==orignode[jsh.uimap['code_val']])) return;
    _this.loadTutorial(node[jsh.uimap['code_val']]);
  }

  _this.loadTutorial = function(tutorial,options,cb){
    if(!options) options = {};
    XForm.prototype.XExecute('../_tutorials/'+tutorial,{}, function (rslt) {
      var config = rslt.config;
      if(typeof options.scrollTop != 'undefined') config.scrollTop = options.scrollTop;
      config.id = tutorial;
      var displayTitle = config.Title;
      //if(config.Menu) for(var i=config.Menu.length-1;i>=0;i--) displayTitle = config.Menu[i] + ' - ' + displayTitle;
      //Add History
      var url = '/tutorials/'+tutorial;
      var anchor = window.location.hash;
      if(anchor) url += anchor;
      
      document.title = 'Tutorial - '+displayTitle;
      if(!options.noHistory){
        XExt.AddHistory(url,config);
      }
      else {
        XExt.ReplaceHistory(url, config);
      }
      jsh.xd('.tutorial_tabs_body').element.scrollTop = 0;
      curTutorial = config;
      curTutorial.Source = rslt.source;
      //Render Title
      jsh.xd('.tutorial_title').text = displayTitle;
      jsh.xd('.tutorial_tabs').style.display = true;
      //Render Tabs (Source, Demo)

      jsh.xd('.tutorial_tabs .left').style.display = true;
      jsh.xd('.tutorial_tabs .overview').style.display = true;

      if(config.Code && config.Code.length) jsh.xd('.tutorial_tabs a.code').style.display = true;
      else jsh.xd('.tutorial_tabs a.code').style.display = false;

      if(config.Demo && config.Demo.length) jsh.xd('.tutorial_tabs a.demo').style.display = true;
      else jsh.xd('.tutorial_tabs a.demo').style.display = false;

      //Add PRE tags to tutorials
      var body = rslt.data;
      body = body.replace(/<pre([^>]*)>([^]*?)<\/pre([^>]*)>/gi, function(match, pre_start, html, pre_end){
        html = XExt.ReplaceAll(html, "<", "&lt;");
        html = XExt.ReplaceAll(html, ">", "&gt;");
        return '<pre'+pre_start+'>'+html+'</pre'+pre_end+'>';
      });

      //Load Tutorial in Body
      var xdtutorial_overview = jsh.xd('.tutorial_overview');
      xdtutorial_overview.html = body;

      //Create outline
      var outline_html = '';
      var outline_count = 0;
      xdtutorial_overview.get('h1,h2,h3').for(function(xdobj){
        if(xdobj.parent('.tutorials_intro').length) return;
        var header_id = getAnchorID(xdobj.innerHTML);
        xdobj.parent().insertBefore(XDom.render('<a class="tutorial_outline_anchor" name="'+header_id+'"></a>'), xdobj.element);
        var level = xdobj.data.level;
        outline_html += '<li class="level'+level+'"><a href="#'+header_id+'">'+XExt.escapeHTML(xdobj.innerHTML)+'</a></li>';
        outline_count++;
      });
      if(outline_html && (outline_count > 1)) xdtutorial_overview.prepend('<ul class="tutorial_outline">'+outline_html+'</ul>');
      var xdIntro = jsh.xd('.tutorial_overview .tutorials_intro');
      if(xdIntro.length) xdtutorial_overview.prepend(xdIntro.elements);

      //Select tab
      jsh.xd('.tutorial_tabs a').class.remove('selected');
      if(jsh.xd('.tutorial_tabs a.overview').isVisible()) _this.viewTutorialOverview();
      else if(jsh.xd('.tutorial_tabs a.code').isVisible()) _this.viewTutorialCodeListing();
      
      //Change selected menu item + scroll into view if not visible
      for(var i=0;i<tutorialsLOV.length;i++){
        var node = tutorialsLOV[i];
        if(node[jsh.uimap['code_val']] == tutorial){
          XExt.TreeSelectNode(jsh.xd('.tutorials_menu').element,node[jsh.uimap['code_val']])
          break;
        }
      }

      onLayout();
      var xdtutorial_tabs_body = jsh.xd('.tutorial_tabs_body');
      if(typeof config.scrollTop !== 'undefined') xdtutorial_tabs_body.element.scrollTop = config.scrollTop;
      else if(anchor){
        var xdanchorpos = XDom('a[name="'+anchor.substr(1)+'"]');
        if(xdanchorpos.length){
          xdtutorial_tabs_body.element.scrollTop = xdanchorpos.calc.top()-xdtutorial_tabs_body.calc.top();
        }
      }

      if(cb) cb();
    });
  }

  _this.viewTutorialOverview = function(){
    jsh.xd('.tutorial_tabs a').class.remove('selected');
    jsh.xd('.tutorial_tabs a.overview').class.add('selected');
    jsh.xd('.tutorial_tabs_body').children.style.display = false;
    jsh.xd('.tutorial_overview').style.display = true;
    jsh.xd('.tutorial_overview pre').for(function(xdobj){
      var html = xdobj.innerHTML;

      //Replace bracketes
      //html = XExt.ReplaceAll(html, "<", "&lt;");
      //html = XExt.ReplaceAll(html, ">", "&gt;");

      //Bring back styles
      if(xdobj.omit('.no_styles,.raw').length){
        html = XExt.ReplaceAll(html, "[i]", "<i>");
        html = XExt.ReplaceAll(html, "[/i]", "</i>");
        html = XExt.ReplaceAll(html, "[b]", "<b>");
        html = XExt.ReplaceAll(html, "[/b]", "</b>");
        html = XExt.ReplaceAll(html, "[anchor]", '<a name="');
        html = XExt.ReplaceAll(html, "[/anchor]", '"></a>');
        html = html.replace(/\[html\](.*)\[\/html\]/g, function(match, p1){
          var rslt = p1;
          rslt = XExt.ReplaceAll(rslt, '&lt;', '<');
          rslt = XExt.ReplaceAll(rslt, '&gt;', '>');
          return rslt;
        });
      }
      xdobj.html = html;
    });
    jsh.xd('.tutorial_overview pre').omit('.shell,.raw').elements.forEach(function(block) {
      hljs.highlightBlock(block);
    });
    jsh.xd('.tutorial_overview span.curdt').text = moment.utc().format();
    jsh.xd('.tutorial_overview a').elements.forEach(function(obj){
      var url = obj.href;
      if(url.substr(0,3)=='id:'){
        var turl = tutorialIDs[url.substr(3)];
        if(turl) XDom(obj).on('click', function(e){ _this.loadTutorial(turl); e.preventDefault(); });
      }
    });

    onLayout();
  }

  _this.viewTutorialCodeListing = function(){
    jsh.xd('.tutorial_tabs a').class.remove('selected');
    jsh.xd('.tutorial_tabs a.code').class.add('selected');
    jsh.xd('.tutorial_tabs_body').children.style.display = false;
    jsh.xd('.tutorial_code_listing').style.display = true;
    //Use template to render
    var ejssource = jsh.xd('.tutorial_code_listing_template').innerHTML;
    ejssource = ejssource.replace(/<#/g,'<%').replace(/#>/g,'%>')
    jsh.xd('.tutorial_code_listing').html = ejs.render(ejssource,{data:curTutorial,xejs:XExt.xejs,jsh:jsh});
    onLayout();
  }

  _this.viewTutorialCode = function(idx){
    jsh.xd('.tutorial_tabs a').class.remove('selected');
    jsh.xd('.tutorial_tabs a.code').class.add('selected');
    jsh.xd('.tutorial_tabs_body').children.style.display = false;
    jsh.xd('.tutorial_code').style.display = true;
    //Use template to render
    var filename = '';
    var source = '';
    if(curTutorial.Code && (curTutorial.Code.length > idx)){
      filename = curTutorial.Code[idx];
      source = curTutorial.Source[filename]||'';
    }
    var ejssource = jsh.xd('.tutorial_code_template').innerHTML;
    ejssource = ejssource.replace(/<#/g,'<%').replace(/#>/g,'%>')
    jsh.xd('.tutorial_code').html = ejs.render(ejssource,{data:{filename:filename,source:source},xejs:XExt.xejs,jsh:jsh});
    jsh.xd('.tutorial_code_source').elements.forEach(function(block) {
      hljs.highlightBlock(block);
    });
    onLayout();
  }

  _this.viewTutorialDemo = function(idx){
    var windowparams = curTutorial.Demo[idx].windowparams||'height=700,width=1000';
    window.open(curTutorial.Demo[idx].url,'_blank',windowparams);
  }

  _this.viewTutorialDemoListing = function(){
    if(!curTutorial.Demo.length) return;
    if(curTutorial.Demo.length==1){ _this.viewTutorialDemo(0); return; }

    jsh.xd('.tutorial_tabs a').class.remove('selected');
    jsh.xd('.tutorial_tabs a.demo').class.add('selected');
    jsh.xd('.tutorial_tabs_body').children.style.display = false;
    jsh.xd('.tutorial_demo_listing').style.display = true;
    //Use template to render
    var ejssource = jsh.xd('.tutorial_demo_listing_template').innerHTML;
    ejssource = ejssource.replace(/<#/g,'<%').replace(/#>/g,'%>')
    jsh.xd('.tutorial_demo_listing').html = ejs.render(ejssource,{data:curTutorial,xejs:XExt.xejs,jsh:jsh});
    onLayout();
  }

  _this.searchTutorials = function(query,options){
    if(!options) options = {};
    jsh.xd('.tutorial_title').html = 'Search Results - ' + query;
    jsh.xd('.tutorial_tabs_body').children.style.display = false;
    var xdsearch_results = jsh.xd('.tutorial_search_results');
    xdsearch_results.clear();
    xdsearch_results.style.display = true;
    jsh.xd('.tutorial_tabs').children.style.display = false;
    XForm.prototype.XExecute('../_search',{ query: query }, function (rslt) {
      document.title = 'Tutorial - Search Results - ' + query;

      var url = '/search/?'+jsh.XExt.escapeQuery({query:query});
      if(!options.noHistory) XExt.AddHistory(url,{});
      var ejssource = jsh.xd('.tutorial_search_results_template').innerHTML;
      ejssource = ejssource.replace(/<#/g,'<%').replace(/#>/g,'%>')
      jsh.xd('.tutorial_search_results').html = ejs.render(ejssource,{data:rslt,xejs:XExt.xejs,tutorials:tutorials,jsh:jsh});
    });
    onLayout();
  }

  _this.saveScroll = function(){
    var scrollTop = jsh.xd('.tutorial_tabs_body').element.scrollTop;
    var curstate = history.state;
    if(!curstate) return;
    XExt.ReplaceHistory(window.location.href, _.extend(curstate,{ scrollTop: scrollTop }));
  }

  XDom.onPageLoad(function(){
    tutorialsLOV = [];
    genTutorialsLOV(tutorialsLOV,tutorialsMenu);
    XExt.TreeRender(jsh.xd('.tutorials_menu').element, tutorialsLOV, 0);
    XExt.TreeExpandAll(jsh.xd('.tutorials_menu').element);
    onLayout();

    var path = window.location.pathname;
    if(XExt.beginsWith(path,'/tutorials/')){
      var tutorial = path.substr(11);
      var scrollTop = undefined;
      if(history.state && (typeof history.state.scrollTop != 'undefined')) scrollTop = history.state.scrollTop;
      _this.loadTutorial(tutorial,{ noHistory: true, scrollTop: scrollTop }, function(){
        //On Complete
      });
    }
    else if(XExt.beginsWith(path,'/search/')){
      _this.searchTutorials(jsh._GET.query||'',{ noHistory: true });
    }

    var xdsearchquery = jsh.xd('.tutorials_search .query'); 
    xdsearchquery.on('focus', function() { 
      var _this = this; 
      var xd_this = XDom(_this);
      xd_this.emit('select'); 
      if(xd_this.value=='Search') xd_this.value = '';
    });
    xdsearchquery.on('mouseup', function(e) { e.preventDefault(); return false; });
    jsh.xd('.tutorial_tabs_body').on('scroll', function(){ _this.saveScroll(); });
    XDom(window).on('resize', function(){ _this.saveScroll(); });
  });

  XDom(window).on('resize', onLayout);

  window.onpopstate = function(event){
    var state = event.state;
    var url = window.location.pathname;
    jsh._GET = XExt.parseGET();
    var scrollTop = undefined;
    if(state && ('scrollTop' in state)) scrollTop = state.scrollTop;
    if(state && state.config && state.config.id) _this.loadTutorial(state.config.id,{ noHistory: true, scrollTop: scrollTop });
    else if(url.indexOf('/search/')==0) _this.searchTutorials(jsh._GET.query||'',{ noHistory: true, scrollTop: scrollTop });
    else if(curTutorial && (url.indexOf('/tutorials/')==0) &&(curTutorial.id==url.substr(11))){ }
    else if(url.indexOf('/tutorials/')==0) _this.loadTutorial(url.substr(11),{ noHistory: true, scrollTop: scrollTop });
  }
}