var path = require('path');

exports = module.exports = function(jsh, config, dbconfig){

  jsh.Extensions.image = require('jsharmony-image-magick');
  jsh.Extensions.report = require('jsharmony-report');


  //Server Settings
  //config.server.http_port = 8080;
  //config.server.https_port = 8081;
  //config.server.https_cert = 'path/to/https-cert.pem';
  //config.server.https_key = 'path/to/https-key.pem';
  //config.server.https_ca = 'path/to/https-ca.pem';
  config.frontsalt = "7.OFwcfK^z_Wa8tKuV}7P6-R9+ac4_Ko+I3w&sQ}Tu%,rOxfT)F&F<HZH){Z";

  //jsHarmony Factory Configuration
  var configFactory = config.modules['jsHarmonyFactory'];
  configFactory.clientsalt = "jFsU,@5S}d8+o%Rg-Ll$&QQ{1wcDmUPSFe6zh*Zy]MyWI{L1moasmh63af@w";
  configFactory.clientcookiesalt = "GTBByV{HQX1lx<rH<F?sV5)>wnl4OWbSVrhCF}[S[9d81&z2[8ip6Ts#[Pz$";
  configFactory.mainsalt = "a>wXX|{0L_9t3L!-0PBK79x{*TFlq%EFPVr$$>CLNEu^K0A8inIwW%r@CI8?";
  configFactory.maincookiesalt = "n@17h9c8.Qj2}nQoWcMi$g>IFYsm8|k9FOIVc?jnzJ$EYD-AM>L(r{CikH^d";

  var configTutorials = config.modules['jsHarmonyTutorials'];
  if(configTutorials){
    configTutorials.enable_dev = true;
  }

  config.onServerReady.push(function(cb, servers){
    var port = jsh.Config.server.http_port;
    if(jsh.Servers['default'] && jsh.Servers['default'].servers && jsh.Servers['default'].servers.length) port = jsh.Servers['default'].servers[0].address().port;
    var exec = require('child_process').exec;
    exec('start http://localhost:'+port+'/', { });
    return cb();
  });
}
