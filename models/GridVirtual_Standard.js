jsh.App[modelid] = new (function(){
  var _this = this;

  //Member variables
  this.cust = [];
  this.LOVs = { };

  this.onload = function(){
    this.initCust();
  }

  //Create model, draw controls
  this.initCust = function(){
    if('Customer' in jsh.XModels) return; //Grid already loaded

    //Define the grid in-memory
    XPage.LoadVirtualModel($('.'+xmodel.class+'_grid_container')[0], {
      "id": "Customer",
      "layout": "grid",
      'title': 'Customers',
      "parent": xmodel.id,
      "unbound": true,
      "buttons": [
        {"link": "js:_this.showTestMessage()", "icon": "ok", "actions":"BIU", "text":"Test Message"},
        {"link": "js:_this.save()", "icon": "save", "actions":"IU", "text":"Save"},
      ],
      "hide_system_buttons": ["export"],
      "ejs": "<div class='<%%=model.class%%>_sample_ejs'>Sample EJS for <%%=model.id%%> model</div>",
      "css": ".<%%=model.class%%>_sample_ejs { background-color:#f0f0f0; border:1px solid #bbb; padding:4px 20px; margin-top:10px; }",
      "js": function(){ //This function is virtual and cannot reference any variables outside its scope
        var _this = this;
        //var modelid = [current model id];
        //var xmodel = [current model];
        var apiGrid = new jsh.XAPI.Grid.Static(modelid);
        var apiForm = new jsh.XAPI.Form.Static(modelid);

        _this.oninit = function(xmodel){
          //Custom oninit function
        }

        _this.onload = function(xmodel){
          //Custom onload function
        }

        _this.getapi = function(xmodel, apitype){
          if(apitype=='grid') return apiGrid;
          else if(apitype=='form') return apiForm;
        }

        _this.save = function(){
          jsh.App[xmodel.parent].commitCust();
        }

        _this.showTestMessage = function(){
          XExt.Alert('Test Message');
        }
      },
      "oninit":"_this.oninit(xmodel);",
      "onload":"_this.onload(xmodel);",
      "getapi":"return _this.getapi(xmodel, apitype);",
      "fields": [
        {"name": "cust_id", "caption":"Customer ID", "type": "int", "actions":"B", "control":"label", "key": true },
         
        {"name": "cust_name", "caption":"Name", "type": "varchar", "length": 256, "control":"textbox", "validate": ["Required", "MaxLength:256"] },
         
        {"name": "cust_sts", "caption":"Status", "type": "varchar", "length":32, "control":"dropdown", "validate": ["Required"] },
      ]
    }, function(custmodel){
      //Model loaded
      //Connect model dataset with local dataset
      jsh.XModels['Customer'].getapi('grid').dataset = _this.cust;
      jsh.XModels['Customer'].getapi('form').dataset = _this.cust;
      jsh.XModels['Customer'].getapi('form').onInsert = function(action, actionrslt, newrow){
        var max_cust_id = _.max(_.map(_this.cust,function(row){ return row.cust_id; }));
        newrow.cust_id = (max_cust_id||0)+1;
        actionrslt['Customer'] = { cust_id: newrow.cust_id };
      }
      //Get customer data from API
      _this.api_getCust();
    });

  }

  //Render Grid
  this.renderCust = function(){
    //Apply List of Values
    jsh.XModels['Customer'].controller.setLOV('cust_sts', _this.LOVs.cust_sts);
    jsh.XModels['Customer'].controller.Render();
  }

  //Get / Validate Grid Values, Save to In-memory Dataset
  this.commitCust = function(){
    jsh.XModels['Customer'].controller.Commit();
  }


  /////////
  // API //
  /////////

  //Get customer status data from the database API
  this.api_getCust = function(onComplete){
    var emodelid = xmodel.namespace+'GridVirtual_Standard_Get_Cust';
    //Execute the GridVirtual_Standard_Get_Cust model
    XForm.prototype.XExecutePost(emodelid, { }, function (rslt) { //On Success
      if ('_success' in rslt) {

        //Populate arrays + Render
        _this.cust.splice(0);
        for(var i=0;i<rslt[emodelid][0].length;i++) _this.cust.push(rslt[emodelid][0][i]);
        if(rslt[emodelid][1]) rslt[emodelid][1].unshift({ code_val: '', code_txt: 'Please select...' });
        _this.LOVs.cust_sts = rslt[emodelid][1];

        _this.renderCust();
        if (onComplete) onComplete();
      }
      else XExt.Alert('Error while loading data');
    }, function (err) {
      //Additional error handling
    });
  }

})();
